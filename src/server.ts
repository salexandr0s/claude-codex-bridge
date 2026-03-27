import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { InMemoryTaskMessageQueue, InMemoryTaskStore } from '@modelcontextprotocol/sdk/experimental/tasks';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { getRepoStatus } from './git.js';
import { runNativeReview, runPlan, runSessionReview } from './codex.js';
import { toToolResult } from './result.js';
import { loadSessionState, resetSessionState, saveSessionState } from './session-state.js';
import type { CodexPlanInput, CodexReviewInput, SessionState, ToolPayload } from './types.js';

function makeDirtyRepoMessage(cwd: string): string {
  return [
    `No session baseline exists yet for ${cwd}.`,
    'The repository is already dirty, so the bridge will not silently assume those existing changes belong to this session.',
    'Recommended fallback: run codex_review with mode="uncommitted" for a one-off review, or reset the session baseline once you are ready to start tracking new work.',
  ].join('\n');
}

function makeInitializedMessage(state: SessionState): string {
  return [
    'Initialized a new repo session baseline.',
    `Repo root: ${state.repoRoot}`,
    `Baseline branch: ${state.baselineBranch}`,
    `Baseline commit: ${state.baselineCommitSha}`,
    `Created at: ${state.createdAt}`,
  ].join('\n');
}

const taskStore = new InMemoryTaskStore();
const taskMessageQueue = new InMemoryTaskMessageQueue();

const server = new McpServer(
  {
    name: 'claude-codex-bridge',
    version: '0.1.0',
  },
  {
    capabilities: {
      tasks: {
        requests: {
          tools: {
            call: {},
          },
        },
      },
    },
    defaultTaskPollInterval: 1000,
    taskStore,
    taskMessageQueue,
  },
);

function toTaskResult(payload: ToolPayload): { status: 'completed' | 'failed'; result: CallToolResult } {
  return {
    status: payload.ok ? 'completed' : 'failed',
    result: toToolResult(payload),
  };
}

function createTaskOptions(taskRequestedTtl: number | null | undefined): { ttl?: number | null } {
  return taskRequestedTtl === undefined ? {} : { ttl: taskRequestedTtl };
}

async function storeTaskPayload(
  taskId: string,
  taskStore: {
    storeTaskResult: (taskId: string, status: 'completed' | 'failed', result: CallToolResult) => Promise<void>;
  },
  work: () => Promise<ToolPayload>,
): Promise<void> {
  try {
    const payload = await work();
    const taskResult = toTaskResult(payload);
    await taskStore.storeTaskResult(taskId, taskResult.status, taskResult.result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await taskStore.storeTaskResult(
      taskId,
      'failed',
      toToolResult({
        ok: false,
        mode: 'task-execution',
        elapsedMs: 0,
        error: 'Task execution failed.',
        content: message,
      }),
    );
  }
}

server.experimental.tasks.registerToolTask(
  'codex_plan',
  {
    title: 'Codex Plan',
    description: 'Delegate planning to the local Codex CLI and return the resulting plan.',
    inputSchema: {
      cwd: z.string().min(1),
      task: z.string().min(1),
      contextPaths: z.array(z.string()).optional(),
      instructions: z.string().optional(),
      model: z.string().optional(),
      profile: z.string().optional(),
    },
    execution: {
      taskSupport: 'optional',
    },
  },
  {
    async createTask(args, { taskStore, taskRequestedTtl }) {
      const task = await taskStore.createTask(createTaskOptions(taskRequestedTtl));

      void storeTaskPayload(task.taskId, taskStore, async () => await runPlan(args as CodexPlanInput));

      return { task };
    },
    async getTask(_args, { taskId, taskStore }) {
      return await taskStore.getTask(taskId);
    },
    async getTaskResult(_args, { taskId, taskStore }) {
      return (await taskStore.getTaskResult(taskId)) as CallToolResult;
    },
  },
);

server.experimental.tasks.registerToolTask(
  'codex_review',
  {
    title: 'Codex Review',
    description: 'Delegate code review to the local Codex CLI. Defaults to repo-session review.',
    inputSchema: {
      cwd: z.string().min(1),
      mode: z.enum(['session', 'uncommitted', 'base', 'commit']).default('session'),
      instructions: z.string().optional(),
      base: z.string().optional(),
      commit: z.string().optional(),
      paths: z.array(z.string()).optional(),
      model: z.string().optional(),
      profile: z.string().optional(),
    },
    execution: {
      taskSupport: 'optional',
    },
  },
  {
    async createTask(args, { taskStore, taskRequestedTtl }) {
      const input = args as CodexReviewInput;

      if (input.mode === 'base' && !input.base) {
        const task = await taskStore.createTask(createTaskOptions(taskRequestedTtl));
        await taskStore.storeTaskResult(
          task.taskId,
          'failed',
          toToolResult({
            ok: false,
            mode: 'base',
            elapsedMs: 0,
            error: 'Missing required input: base',
            content: 'Provide a base branch when mode="base".',
          }),
        );
        return { task };
      }

      if (input.mode === 'commit' && !input.commit) {
        const task = await taskStore.createTask(createTaskOptions(taskRequestedTtl));
        await taskStore.storeTaskResult(
          task.taskId,
          'failed',
          toToolResult({
            ok: false,
            mode: 'commit',
            elapsedMs: 0,
            error: 'Missing required input: commit',
            content: 'Provide a commit SHA when mode="commit".',
          }),
        );
        return { task };
      }

      const task = await taskStore.createTask(createTaskOptions(taskRequestedTtl));

      void storeTaskPayload(task.taskId, taskStore, async () => {
        let payload: ToolPayload;

        if (input.mode !== 'session') {
          payload = await runNativeReview(input);
        } else {
          const status = await getRepoStatus(input.cwd);
          const existingState = await loadSessionState(status.repoRoot);

          if (!existingState) {
            if (status.isDirty) {
              payload = {
                ok: false,
                mode: 'session',
                elapsedMs: 0,
                error: 'Cannot initialize a session baseline in a dirty repository.',
                content: makeDirtyRepoMessage(status.repoRoot),
              };
            } else {
              const state: SessionState = {
                repoRoot: status.repoRoot,
                baselineCommitSha: status.headSha,
                baselineBranch: status.branch,
                createdAt: new Date().toISOString(),
                dirtyAtStart: false,
              };
              await saveSessionState(state);
              payload = {
                ok: true,
                mode: 'session-init',
                elapsedMs: 0,
                content: makeInitializedMessage(state),
              };
            }
          } else {
            payload = await runSessionReview(input, status, existingState);
            if (payload.ok) {
              await saveSessionState({ ...existingState, lastReviewAt: new Date().toISOString() });
            }
          }
        }

        return payload;
      });

      return { task };
    },
    async getTask(_args, { taskId, taskStore }) {
      return await taskStore.getTask(taskId);
    },
    async getTaskResult(_args, { taskId, taskStore }) {
      return (await taskStore.getTaskResult(taskId)) as CallToolResult;
    },
  },
);

server.registerTool(
  'codex_session_status',
  {
    title: 'Codex Session Status',
    description: 'Show the current repo baseline used by codex_review session mode.',
    inputSchema: {
      cwd: z.string().min(1),
    },
  },
  async (args) => {
    const status = await getRepoStatus(args.cwd as string);
    const state = await loadSessionState(status.repoRoot);

    if (!state) {
      return toToolResult({
        ok: true,
        mode: 'session-status',
        elapsedMs: 0,
        content: 'No repo baseline exists yet for this repository.',
      });
    }

    return toToolResult({
      ok: true,
      mode: 'session-status',
      elapsedMs: 0,
      content: [
        `Repo root: ${state.repoRoot}`,
        `Baseline branch: ${state.baselineBranch}`,
        `Baseline commit: ${state.baselineCommitSha}`,
        `Created at: ${state.createdAt}`,
        `Last review at: ${state.lastReviewAt ?? '(never)'}`,
      ].join('\n'),
    });
  },
);

server.registerTool(
  'codex_session_reset',
  {
    title: 'Codex Session Reset',
    description: 'Reset the repo baseline used by codex_review session mode.',
    inputSchema: {
      cwd: z.string().min(1),
    },
  },
  async (args) => {
    const status = await getRepoStatus(args.cwd as string);
    await resetSessionState(status.repoRoot);

    return toToolResult({
      ok: true,
      mode: 'session-reset',
      elapsedMs: 0,
      content: `Reset repo baseline for ${status.repoRoot}`,
    });
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

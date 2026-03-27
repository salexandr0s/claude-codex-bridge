import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { getRepoStatus } from './git.js';
import { runNativeReview, runPlan, runSessionReview } from './codex.js';
import { formatToolText, toToolResult } from './result.js';
import { loadSessionState, resetSessionState, saveSessionState } from './session-state.js';
import type { CodexPlanInput, CodexReviewInput, SessionState } from './types.js';

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

const server = new McpServer({
  name: 'claude-codex-bridge',
  version: '0.1.0',
});

server.registerTool(
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
  },
  async (args) => {
    const payload = await runPlan(args as CodexPlanInput);
    return toToolResult(payload);
  },
);

server.registerTool(
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
  },
  async (args) => {
    const input = args as CodexReviewInput;

    if (input.mode === 'base' && !input.base) {
      return toToolResult({
        ok: false,
        mode: 'base',
        elapsedMs: 0,
        error: 'Missing required input: base',
        content: 'Provide a base branch when mode="base".',
      });
    }

    if (input.mode === 'commit' && !input.commit) {
      return toToolResult({
        ok: false,
        mode: 'commit',
        elapsedMs: 0,
        error: 'Missing required input: commit',
        content: 'Provide a commit SHA when mode="commit".',
      });
    }

    if (input.mode !== 'session') {
      return toToolResult(await runNativeReview(input));
    }

    const status = await getRepoStatus(input.cwd);
    const existingState = await loadSessionState(status.repoRoot);

    if (!existingState) {
      if (status.isDirty) {
        return toToolResult({
          ok: false,
          mode: 'session',
          elapsedMs: 0,
          error: 'Cannot initialize a session baseline in a dirty repository.',
          content: makeDirtyRepoMessage(status.repoRoot),
        });
      }

      const state: SessionState = {
        repoRoot: status.repoRoot,
        baselineCommitSha: status.headSha,
        baselineBranch: status.branch,
        createdAt: new Date().toISOString(),
        dirtyAtStart: false,
      };
      await saveSessionState(state);

      return {
        content: [{ type: 'text', text: makeInitializedMessage(state) }],
      };
    }

    const payload = await runSessionReview(input, status, existingState);
    if (payload.ok) {
      await saveSessionState({ ...existingState, lastReviewAt: new Date().toISOString() });
    }
    return toToolResult(payload);
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
      return {
        content: [{ type: 'text', text: 'No repo baseline exists yet for this repository.' }],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: formatToolText({
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
          }),
        },
      ],
    };
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

    return {
      content: [{ type: 'text', text: `Reset repo baseline for ${status.repoRoot}` }],
    };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';

import { describeSessionScope } from './git.js';
import { buildPlanPrompt, buildSessionReviewPrompt } from './prompts.js';
import type { CommandExecutionResult, CodexPlanInput, CodexReviewInput, RepoStatus, SessionState, ToolPayload } from './types.js';

interface BaseRunOptions {
  cwd: string;
  model?: string;
  profile?: string;
}

async function runCodexCommand(args: string[], options: BaseRunOptions): Promise<CommandExecutionResult> {
  const tempDir = await mkdtemp(join(tmpdir(), 'claude-codex-bridge-'));
  const outputPath = join(tempDir, 'last-message.txt');
  const fullArgs = [...args, '--output-last-message', outputPath, '-C', options.cwd];

  if (options.model) {
    fullArgs.push('--model', options.model);
  }

  if (options.profile) {
    fullArgs.push('--profile', options.profile);
  }

  const child = spawn('codex', fullArgs, {
    cwd: options.cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (chunk: Buffer) => {
    stdout += chunk.toString();
  });

  child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });

  let lastMessage: string | undefined;
  try {
    lastMessage = await readFile(outputPath, 'utf8');
  } catch {
    lastMessage = undefined;
  }

  await rm(tempDir, { recursive: true, force: true });
  return {
    exitCode,
    stdout,
    stderr,
    ...(lastMessage === undefined ? {} : { lastMessage }),
  };
}

function buildFailurePayload(mode: string, elapsedMs: number, result: CommandExecutionResult): ToolPayload {
  const detail = result.stderr.trim() || result.stdout.trim() || 'Codex exited without a readable error message.';
  return {
    ok: false,
    mode,
    elapsedMs,
    error: `Codex command failed with exit code ${result.exitCode}`,
    content: detail,
  };
}

export async function runPlan(input: CodexPlanInput): Promise<ToolPayload> {
  const startedAt = performance.now();
  const prompt = buildPlanPrompt(input);
  const result = await runCodexCommand(['exec', '--sandbox', 'read-only', prompt], input);
  const elapsedMs = Math.round(performance.now() - startedAt);

  if (result.exitCode !== 0) {
    return buildFailurePayload('plan', elapsedMs, result);
  }

  return {
    ok: true,
    mode: 'plan',
    elapsedMs,
    content: result.lastMessage?.trim() || result.stdout.trim() || 'Codex produced no final output.',
  };
}

export async function runSessionReview(input: CodexReviewInput, status: RepoStatus, state: SessionState): Promise<ToolPayload> {
  const startedAt = performance.now();
  const scopeDescription = await describeSessionScope(status, state);
  const prompt = buildSessionReviewPrompt(input, scopeDescription);
  const result = await runCodexCommand(['exec', '--sandbox', 'read-only', prompt], input);
  const elapsedMs = Math.round(performance.now() - startedAt);

  if (result.exitCode !== 0) {
    return buildFailurePayload('session-review', elapsedMs, result);
  }

  return {
    ok: true,
    mode: 'session-review',
    elapsedMs,
    content: result.lastMessage?.trim() || result.stdout.trim() || 'Codex produced no final output.',
  };
}

export async function runNativeReview(input: CodexReviewInput): Promise<ToolPayload> {
  const startedAt = performance.now();
  const args = ['exec', 'review'];

  if (input.mode === 'uncommitted') {
    args.push('--uncommitted');
  }

  if (input.mode === 'base' && input.base) {
    args.push('--base', input.base);
  }

  if (input.mode === 'commit' && input.commit) {
    args.push('--commit', input.commit);
  }

  if (input.instructions?.trim()) {
    args.push(input.instructions.trim());
  }

  const result = await runCodexCommand(args, input);
  const elapsedMs = Math.round(performance.now() - startedAt);

  if (result.exitCode !== 0) {
    return buildFailurePayload(`native-review:${input.mode}`, elapsedMs, result);
  }

  return {
    ok: true,
    mode: `native-review:${input.mode}`,
    elapsedMs,
    content: result.lastMessage?.trim() || result.stdout.trim() || 'Codex produced no final output.',
  };
}

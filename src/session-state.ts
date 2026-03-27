import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

import type { SessionState } from './types.js';

function getStateDir(): string {
  return join(homedir(), '.claude', 'codex-bridge-state');
}

function getStatePath(repoRoot: string): string {
  const hash = createHash('sha256').update(repoRoot).digest('hex').slice(0, 16);
  return join(getStateDir(), `${hash}.json`);
}

export async function loadSessionState(repoRoot: string): Promise<SessionState | null> {
  try {
    const raw = await readFile(getStatePath(repoRoot), 'utf8');
    return JSON.parse(raw) as SessionState;
  } catch {
    return null;
  }
}

export async function saveSessionState(state: SessionState): Promise<void> {
  const target = getStatePath(state.repoRoot);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export async function resetSessionState(repoRoot: string): Promise<void> {
  await rm(getStatePath(repoRoot), { force: true });
}

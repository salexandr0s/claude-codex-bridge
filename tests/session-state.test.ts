import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSessionState, resetSessionState, saveSessionState } from '../src/session-state.js';
import type { SessionState } from '../src/types.js';

const savedHome = process.env.HOME;

afterEach(() => {
  if (savedHome) {
    process.env.HOME = savedHome;
  }
});

describe('session-state', () => {
  it('saves and loads repo session state', async () => {
    const fakeHome = await mkdtemp(join(tmpdir(), 'claude-codex-bridge-home-'));
    process.env.HOME = fakeHome;

    const state: SessionState = {
      repoRoot: '/tmp/example',
      baselineCommitSha: 'abc123',
      baselineBranch: 'main',
      createdAt: '2026-03-27T00:00:00.000Z',
      dirtyAtStart: false,
    };

    await saveSessionState(state);
    await expect(loadSessionState('/tmp/example')).resolves.toEqual(state);
  });

  it('resets saved state', async () => {
    const fakeHome = await mkdtemp(join(tmpdir(), 'claude-codex-bridge-home-'));
    process.env.HOME = fakeHome;

    const state: SessionState = {
      repoRoot: '/tmp/example',
      baselineCommitSha: 'abc123',
      baselineBranch: 'main',
      createdAt: '2026-03-27T00:00:00.000Z',
      dirtyAtStart: false,
    };

    await saveSessionState(state);
    await resetSessionState('/tmp/example');
    await expect(loadSessionState('/tmp/example')).resolves.toBeNull();
  });
});

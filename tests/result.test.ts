import { describe, expect, it } from 'vitest';

import { buildScopedReviewPrompt, buildSessionReviewPrompt } from '../src/prompts.js';
import { buildCodexCommandArgs } from '../src/codex.js';
import { formatToolText } from '../src/result.js';

describe('formatToolText', () => {
  it('formats tool payload text consistently', () => {
    const text = formatToolText({
      ok: true,
      mode: 'plan',
      elapsedMs: 42,
      content: '# Hello',
    });

    expect(text).toContain('ok: true');
    expect(text).toContain('mode: plan');
    expect(text).toContain('# Hello');
  });

  it('includes focus paths in review prompts when provided', () => {
    const prompt = buildSessionReviewPrompt(
      {
        cwd: '/tmp/example',
        mode: 'session',
        paths: ['src/server.ts', 'README.md'],
      },
      'Repo root: /tmp/example',
    );

    expect(prompt).toContain('Focus paths:');
    expect(prompt).toContain('- src/server.ts');
    expect(prompt).toContain('- README.md');
  });

  it('builds scoped review prompts for base mode', () => {
    const prompt = buildScopedReviewPrompt({
      cwd: '/tmp/example',
      mode: 'base',
      base: 'main',
      instructions: 'Focus on auth.',
    });

    expect(prompt).toContain('against base ref: main');
    expect(prompt).toContain('Focus on auth.');
  });

  it('places -C before the codex subcommand args', () => {
    const args = buildCodexCommandArgs(['exec', '--sandbox', 'read-only', 'Review this.'], { cwd: '/tmp/example' }, '/tmp/out.txt');

    expect(args.slice(0, 3)).toEqual(['-C', '/tmp/example', 'exec']);
    expect(args).toContain('--output-last-message');
  });
});

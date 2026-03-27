import { describe, expect, it } from 'vitest';

import { buildSessionReviewPrompt } from '../src/prompts.js';
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
});

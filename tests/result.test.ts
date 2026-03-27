import { describe, expect, it } from 'vitest';

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
});

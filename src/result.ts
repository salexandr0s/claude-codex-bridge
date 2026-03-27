import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { ToolPayload } from './types.js';

export function formatToolText(payload: ToolPayload): string {
  const lines = [
    `ok: ${payload.ok ? 'true' : 'false'}`,
    `mode: ${payload.mode}`,
    `elapsed_ms: ${payload.elapsedMs}`,
  ];

  if (payload.error) {
    lines.push(`error: ${payload.error}`);
  }

  lines.push('', payload.content.trim());
  return lines.join('\n');
}

export function toToolResult(payload: ToolPayload): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: formatToolText(payload),
      },
    ],
    ...(payload.ok ? {} : { isError: true }),
  };
}

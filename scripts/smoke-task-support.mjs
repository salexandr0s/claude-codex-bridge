import { cwd as getCwd } from 'node:process';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const serverPath = new URL('../dist/src/server.js', import.meta.url);
const client = new Client(
  {
    name: 'claude-codex-bridge-smoke',
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
  },
);

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverPath.pathname],
  cwd: getCwd(),
  stderr: 'pipe',
});

const stderrChunks = [];
transport.stderr?.on('data', (chunk) => {
  stderrChunks.push(chunk.toString());
});

function extractText(result) {
  return result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

try {
  await client.connect(transport);
  await client.listTools();

  const events = [];
  for await (const message of client.experimental.tasks.callToolStream(
    {
      name: 'codex_plan',
      arguments: {
        cwd: getCwd(),
        task: 'Create a short two-step implementation plan for adding a README heading. Keep it brief.',
      },
    },
    undefined,
    {
      timeout: 180000,
    },
  )) {
    events.push(message.type);

    if (message.type === 'result') {
      const text = extractText(message.result);
      if (!text.includes('mode: plan')) {
        throw new Error(`Unexpected plan result payload:\n${text}`);
      }
      console.log(`task events: ${events.join(' -> ')}`);
      console.log('result ok');
      process.exit(0);
    }

    if (message.type === 'error') {
      throw new Error(`Task stream failed: ${message.error.message}`);
    }
  }

  throw new Error(`Task stream ended without a result. Events: ${events.join(' -> ')}`);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  const stderr = stderrChunks.join('').trim();
  console.error(detail);
  if (stderr) {
    console.error('\nServer stderr:\n' + stderr);
  }
  process.exit(1);
} finally {
  await client.close().catch(() => undefined);
}

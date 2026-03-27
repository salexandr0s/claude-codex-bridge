#!/usr/bin/env node
import { mkdirSync, readFileSync, symlinkSync, writeFileSync, existsSync, lstatSync, unlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { homedir } from 'node:os';

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..');
const commandsSource = join(repoRoot, 'claude', 'commands');
const claudeRoot = join(homedir(), '.claude');
const mcpConfigPath = join(claudeRoot, '.mcp.json');
const commandsTargetRoot = resolve(join(claudeRoot, 'commands'));
const serverEntry = join(repoRoot, 'dist', 'server.js');
const commandNames = ['codexplan.md', 'codexreview.md', 'codexsession.md'];

mkdirSync(commandsTargetRoot, { recursive: true });

for (const name of commandNames) {
  const source = join(commandsSource, name);
  const target = join(commandsTargetRoot, name);

  if (existsSync(target)) {
    const stats = lstatSync(target);
    if (stats.isSymbolicLink() || stats.isFile()) {
      unlinkSync(target);
    }
  }

  symlinkSync(source, target);
}

let config = {};
if (existsSync(mcpConfigPath)) {
  config = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
}

config['claude-codex-bridge'] = {
  command: 'node',
  args: [serverEntry],
};

writeFileSync(mcpConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
console.log(`Installed Claude commands into ${commandsTargetRoot}`);
console.log(`Updated MCP config at ${mcpConfigPath}`);

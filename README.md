# claude-codex-bridge

Local MCP-backed bridge that lets Claude Code delegate planning and review work to the installed Codex CLI.

## What it adds

- `/codexplan` — ask Codex for an implementation plan
- `/codexreview` — review work done in the current repo session
- `/codexsession` — show or reset the repo baseline used for session review

## How it works

- Claude talks to a local MCP server from this repo.
- The MCP server shells out to `codex exec` / `codex exec review`.
- Session review is repo-local and baseline-based.
- Codex runs read-only by default.

## Install

```bash
npm install
npm run build
npm run install:local
```

That will:

- add `claude-codex-bridge` to `~/.claude/.mcp.json`
- symlink the command files into `~/.claude/commands`
- point Claude at `dist/src/server.js`

## Dev

```bash
npm run lint
npm run build
npm run test
npm run verify
```

## Notes

- Session review will not auto-initialize in a dirty repo.
- Sensitive paths like `.env*`, `*.pem`, `*.key`, and obvious secrets folders are excluded from session file summaries.
- Native review fallback is available for `uncommitted`, `base`, and `commit` modes.

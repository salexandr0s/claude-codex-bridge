# Project Rules

This project is a local-first TypeScript MCP server and Claude command pack.

## Verification

Run these before marking work complete:

```bash
npm run lint
npm run build
npm run test
```

## Standards

- Keep Codex subprocesses read-only by default.
- Do not silently include sensitive files in prompts or review scope.
- Prefer typed interfaces and named exports.
- Keep Claude commands thin; shared logic belongs in the MCP server.

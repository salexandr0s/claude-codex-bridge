---
description: Delegate implementation planning to Codex via the local MCP bridge
---
Use the `codex_plan` tool.

Inputs:
- `cwd`: current working directory
- `task`: `$ARGUMENTS`

If `$ARGUMENTS` is empty, infer the plan request from the current conversation.

Return:
1. The Codex plan first
2. A short Claude summary of the plan

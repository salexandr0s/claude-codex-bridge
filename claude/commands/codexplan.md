---
description: Delegate implementation planning to Codex via the local MCP bridge
---
Delegate planning to Codex with the `codex_plan` tool.

Inputs:
- `cwd`: current working directory
- `task`: `$ARGUMENTS`

If `$ARGUMENTS` is empty, infer the plan request from the current conversation.

Behavior:
- Pass the user's request through with minimal rewriting.
- Preserve the Codex plan as the source of truth.
- Do not replace or paraphrase away important details from Codex.

Output format:
1. `## Codex Plan`
   - Paste the tool output as-is
2. `## Claude Summary`
   - 2-4 bullets only:
     - goal
     - critical path
     - biggest risk / open question

If the tool reports an error:
- say the Codex delegation failed
- quote the error briefly
- give the single best next step

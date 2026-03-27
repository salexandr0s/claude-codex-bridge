---
description: Review work done in this repo session via Codex
---
Use the `codex_review` tool.

Inputs:
- `cwd`: current working directory
- `mode`: `session`
- `instructions`: `$ARGUMENTS` if provided

Behavior:
- If no repo baseline exists yet and the repo is clean, allow the tool to initialize it.
- If the tool reports a dirty-start repository, explain that the baseline was not created and recommend either:
  - one-off uncommitted review, or
  - resetting the baseline once the user is ready

Return:
1. The Codex review first
2. A short Claude summary with the top findings

---
description: Show or reset the repo baseline used by Codex session review
---
If `$ARGUMENTS` contains `reset`, use the `codex_session_reset` tool with the current working directory.
Otherwise use the `codex_session_status` tool with the current working directory.

Output format:
- `## Codex Session`
- then a short explanation of what the current baseline means for `/codexreview`

If reset was requested:
- confirm the baseline was cleared
- tell the user that the next `/codexreview` in a clean repo will create a fresh baseline

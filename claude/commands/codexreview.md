---
description: Review work done in this repo session via Codex
---
Delegate review to Codex with the `codex_review` tool.

Inputs:
- `cwd`: current working directory
- `mode`: `session`
- `instructions`: `$ARGUMENTS` if provided

Behavior:
- If no repo baseline exists yet and the repo is clean, allow the tool to initialize it.
- If the tool reports a dirty-start repository, explain that the baseline was not created and recommend either:
  - one-off uncommitted review, or
  - resetting the baseline once the user is ready
- Preserve the Codex review as the primary review artifact.
- Do not dilute severity or remove concrete findings.

Output format:
1. `## Codex Review`
   - Paste the tool output as-is
2. `## Claude Summary`
   - include:
     - verdict
     - top 1-3 findings
     - immediate next step

If the tool initialized a new baseline instead of reviewing:
- explain that no review was run yet
- tell the user that the next `/codexreview` will review work since that baseline

If the tool reports a dirty-start repository:
- explain the repo was already dirty before a baseline existed
- recommend `/codexsession reset` once the user wants a fresh baseline
- mention that a one-off uncommitted review is the fallback

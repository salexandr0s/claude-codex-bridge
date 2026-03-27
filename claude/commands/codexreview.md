---
description: Review work done in this repo session via Codex
---
Delegate review to Codex with the `codex_review` tool.

Parse `$ARGUMENTS` using this exact precedence:

1. If it starts with `uncommitted`
   - call `codex_review` with:
     - `cwd`: current working directory
     - `mode`: `uncommitted`
     - `instructions`: any remaining text after `uncommitted`
2. If it starts with `base <ref>`
   - call `codex_review` with:
     - `cwd`: current working directory
     - `mode`: `base`
     - `base`: `<ref>`
     - `instructions`: any remaining text after `<ref>`
3. If it starts with `commit <sha>`
   - call `codex_review` with:
     - `cwd`: current working directory
     - `mode`: `commit`
     - `commit`: `<sha>`
     - `instructions`: any remaining text after `<sha>`
4. Otherwise
   - call `codex_review` with:
     - `cwd`: current working directory
     - `mode`: `session`
     - `instructions`: full `$ARGUMENTS` if present

Validation:
- If the user says `base` without a ref, do not call the tool. Show:
  - `Usage: /codexreview base <ref> [extra review instructions]`
- If the user says `commit` without a sha, do not call the tool. Show:
  - `Usage: /codexreview commit <sha> [extra review instructions]`

Behavior:
- Preserve the Codex review as the primary review artifact.
- Do not dilute severity or remove concrete findings.
- Only mention session baseline behavior for `mode: session`.
- For `uncommitted`, `base`, and `commit`, present the review as a one-off scope-specific review.

Output format:
1. `## Codex Review`
   - Paste the tool output as-is
2. `## Claude Summary`
   - include:
     - verdict
     - top 1-3 findings
     - immediate next step

If `mode: session` initialized a new baseline instead of reviewing:
- explain that no review was run yet
- tell the user that the next `/codexreview` will review work since that baseline

If `mode: session` reports a dirty-start repository:
- explain the repo was already dirty before a baseline existed
- recommend `/codexsession reset` once the user wants a fresh baseline
- mention that a one-off uncommitted review is the fallback

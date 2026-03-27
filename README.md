# claude-codex-bridge

A local MCP bridge that lets **Claude Code** hand planning and code-review work to the installed **Codex CLI**.

It adds a small, explicit workflow:

- `/codexplan` — ask Codex for an implementation plan
- `/codexreview` — ask Codex to review current work
- `/codexsession` — inspect or reset the repo session baseline used by session review

## Why this exists

Claude is great for interactive coding. Codex is strong at focused planning and review passes. This project gives Claude a clean way to call Codex as a backend tool instead of forcing you to switch contexts manually.

## What you get

- A local **MCP server** that wraps the `codex` CLI
- Claude slash commands with a thin, predictable UX
- Session-based review for "review what I changed in this repo session"
- One-off review scopes for:
  - uncommitted changes
  - diff against a base ref
  - a specific commit
- Read-only Codex execution by default
- MCP task support for long-running plan/review calls

## Architecture

```text
Claude Code
  └─ slash commands (/codexplan, /codexreview, /codexsession)
      └─ local MCP server (this repo)
          └─ codex CLI
              └─ markdown result returned to Claude
```

## Requirements

- Node.js 20+
- `codex` installed and authenticated
- Claude Code with local MCP support
- A git repo when using review modes

## Install

```bash
npm install
npm run build
npm run install:local
```

That installer will:

- add `claude-codex-bridge` to `~/.claude/.mcp.json`
- copy the command files into `~/.claude/commands`
- point Claude at `dist/src/server.js`

After install, restart Claude so it reloads the MCP server.

## Usage

### Planning

```text
/codexplan build a login flow with email + magic link
```

Codex returns a structured plan, then Claude can continue implementing from it.

### Review: session mode

```text
/codexreview
/codexreview focus on auth and tests
```

Default review mode is **session review**:

- on first use in a clean repo, the bridge creates a baseline
- later session reviews cover work changed since that baseline
- if the repo is already dirty on first use, the bridge refuses to guess and asks you to use a one-off mode or reset the baseline

### Review: one-off scopes

```text
/codexreview uncommitted
/codexreview uncommitted focus on tests

/codexreview base main
/codexreview base main look for migration risks

/codexreview commit abc123
/codexreview commit abc123 check security
```

Supported forms:

- `/codexreview`
- `/codexreview <freeform session instructions>`
- `/codexreview uncommitted [extra instructions]`
- `/codexreview base <ref> [extra instructions]`
- `/codexreview commit <sha> [extra instructions]`

### Session status

```text
/codexsession
```

Use this to inspect the current repo baseline or reset it.

## MCP tools exposed

The server provides these tools:

- `codex_plan`
- `codex_review`
- `codex_session_status`
- `codex_session_reset`

The Claude commands are just thin wrappers over those tools.

## Long-running calls and timeout behavior

`codex_plan` and `codex_review` advertise **MCP task support**.

That matters because long Codex runs can exceed the default ~60 second request window in some MCP clients. Task-aware clients can stream task status and wait for the final result without treating the run as a normal short request.

This repo includes a smoke test for that path:

```bash
npm run smoke:tasks
```

## Safety defaults

- Codex runs in **read-only** mode by default
- Session file summaries avoid obvious sensitive paths such as:
  - `.env*`
  - `*.pem`
  - `*.key`
  - common secrets folders
- Dirty repos do not silently initialize a review baseline

## Development

```bash
npm run lint
npm run build
npm run test
npm run verify
npm run smoke:tasks
```

## Troubleshooting

### Claude does not see the commands

- confirm the installer updated `~/.claude/.mcp.json`
- confirm command files exist in `~/.claude/commands`
- restart Claude

### Codex calls fail immediately

Check that `codex` is on your `PATH` and already authenticated.

### `/codexreview` says the repo is dirty

That means no session baseline exists yet and the repo already had changes. Use one of:

- `/codexreview uncommitted`
- `/codexsession` and reset when ready

## License

ISC

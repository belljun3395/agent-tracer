# Codex Setup

This page covers the Codex-specific steps after the shared
[install-and-run](./install-and-run.md) flow.

Unlike Claude Code, Codex does not currently have a plugin packaging surface
that Agent Tracer can publish into. The current Codex integration uses:

- repo-local Codex hooks for interactive sessions
- a repo-local `.codex/config.toml` that enables Codex hooks by default

## 1. Bootstrap the target project

Run [external-setup.md](./external-setup.md) first:

```bash
npm run setup:external -- --target /absolute/path/to/your-project
```

For Codex, the setup script creates:

- `target/.codex/config.toml`
- `target/.codex/hooks.json`

These files reference the Agent Tracer checkout directly with absolute paths.
After setup, the intended usage is simply:

```bash
cd /absolute/path/to/your-project
codex
```

## 2. Prerequisites

- The monitor server is running (`npm run dev` or `npm run dev:server`)
- `curl -sf http://127.0.0.1:3847/api/v1/overview` returns 200
- Codex CLI is installed and working

## 3. Interactive Codex with hooks

Use plain Codex from the target project root:

```bash
cd /absolute/path/to/your-project
codex
```

`setup:external` writes `.codex/config.toml` with `codex_hooks = true`, and
the generated `.codex/hooks.json` embeds `MONITOR_BASE_URL` directly in each
hook command. No extra wrapper is required for the normal interactive path.

### What this captures today

The default external setup registers five Codex hook events:

- `SessionStart` -> `context.saved`
- `UserPromptSubmit` -> `user.message`
- `PreToolUse` (`Bash` only) -> runtime-session-ensure (session guarantee)
- `PostToolUse` (`Bash` only) -> `terminal.command`
- `Stop` -> `assistant.response`

`packages/runtime/src/codex/hooks/PermissionRequest.ts` also exists and records
`rule.logged` for Bash permission requests, but `setup:external` does not add it
to `.codex/hooks.json` by default. Add it manually only if you want that
observation-only event; Agent Tracer never sets `decision.behavior`.

Plus rollout-backed coverage (observer process):

- rollout `response_item.custom_tool_call(apply_patch)` -> `tool.used`
- rollout `response_item.function_call(mcp__...)` -> `agent.activity.logged`
- rollout `response_item.web_search_call` -> `tool.used`

The hook handlers use the shared `runHook()` wrapper and the typed payload
readers at `packages/runtime/src/shared/hooks/codex/payloads.ts`. Turn-scoped
events capture the official `turn_id` and `model` fields when Codex includes
them in the payload.

## 4. Current capture scope

The current Codex integration focuses on interactive hooks.

Default events that can be captured:

- `context.saved`
- `user.message`
- `terminal.command` (`Bash` only)
- `assistant.response`
- `tool.used` (`apply_patch`, web search/fetch via rollout)
- `agent.activity.logged` (MCP calls via rollout)
- `rule.logged` only if the optional `PermissionRequest` hook is added manually

In other words, this stage focuses on capturing the baseline activity of users
who run Codex normally with `codex`.

### Smoke test

Verify the setup in this order:

1. Run `codex` in the target project
2. Submit one short prompt
3. Trigger one Bash command
4. Confirm the following events in the dashboard
   - `context.saved`
   - `user.message`
   - `terminal.command`
   - `assistant.response`
   - `tool.used` if Codex used `apply_patch` or web search/fetch
   - `agent.activity.logged` if Codex used an MCP tool

## 5. Context / model observer

Codex does not currently expose a Claude-style `statusLine` hook. Agent Tracer
now derives status telemetry from the session rollout `.jsonl` that plain
`codex` already writes under `~/.codex/sessions/<YYYY>/<MM>/<DD>/`.

The observer:

- reads the latest Codex session hint written by hooks
- locates the matching `rollout-*.jsonl` for that session id
- tails it for `event_msg` / `token_count` entries
- emits `context.snapshot` events from the rollout's token-usage and rate-limit fields
- emits `tool.used` for rollout `apply_patch` and `web_search_call` entries
- emits `agent.activity.logged` for rollout `mcp__...` function calls
- prints a compact status string such as `[monitor] ctx 30% · 15m 25%`

This observer is now started automatically by the Codex `SessionStart` hook.
In the normal path you do **not** need to launch a second command manually.

If you want to debug or run it by hand, use:

```bash
cd /absolute/path/to/agent-tracer
npm run codex:observe -- --latest-in /absolute/path/to/your-project
```

You can also target a specific thread directly:

```bash
npm run codex:observe -- --thread-id <codex-thread-id>
```

The observer posts:

- `context.snapshot`
  - `contextWindowUsedPct` as soon as Codex writes a `token_count` event
  - `contextWindowSize`
  - `contextWindowTotalTokens`
  - `modelId` (hint from `SessionStart`; provider from rollout `session_meta`)
  - generic primary/secondary rate-limit windows

Since the observer tails the same rollout file that plain `codex` writes, it
does not need to share a transport with the running turn — both context and
rate-limit telemetry are now populated in plain `codex` mode.

## 6. End-to-end check

1. Monitor server is running
2. `setup:external` has been run for the target project
3. Run `codex` from the target project root
4. Submit a prompt that causes one Bash command
5. Confirm the dashboard shows:
   - `context.saved`
   - `user.message`
   - `terminal.command`
   - `assistant.response`
6. If the prompt causes file edits, MCP calls, or web search/fetch, confirm:
   - `tool.used`
   - `agent.activity.logged`
7. Confirm the dashboard starts receiving `context.snapshot` events automatically

## 7. Current limitations

- No dedicated `SessionEnd` hook mapping
- No subagent hierarchy mapping in v1
- `PermissionRequest` is implemented but not registered by `setup:external` by default
- No hook-time interception for non-Bash tools
- Non-Bash tool activity is observed after Codex writes rollout response items;
  it is not a pre-execution policy/interception hook.
- Rollout-backed observation covers `apply_patch`, MCP function calls, and
  web search/fetch. Other future Codex item types need explicit parser support.

For the adapter internals and exact event mapping, see
[`packages/runtime/CODEX_DATA_FLOW.md`](https://github.com/belljun3395/agent-tracer/blob/main/packages/runtime/CODEX_DATA_FLOW.md)
in the repository.

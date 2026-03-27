# Agent Tracer - Codex Setup Guide

This guide is for Codex only.

## 1. Current Status

Supported today:

- repo-local Codex integration in this repository
- manual MCP registration
- repo-local `codex-monitor` skill discovery through `AGENTS.md`
- repo-local hook-based tracking in this repository through `.codex/hooks.json`
- thread/topic-scoped Codex task reuse through runtime session ensure/end
- manual `assistant.response` capture through the Codex skill flow
- external-project bootstrap through `setup:external --mode codex`

Still manual:

- global Codex MCP registration on the machine that runs Codex
- restarting the Codex thread after new repo instructions are written

## 2. What `setup:external --mode codex` Automates

The script:

- creates or updates the managed Agent Tracer block in `target-project/AGENTS.md`
- writes `target-project/.agents/skills/codex-monitor/SKILL.md`
- writes or merges `target-project/.codex/config.toml` with `codex_hooks = true`
- writes or merges `target-project/.codex/hooks.json`
- vendors `.codex/hooks/*.ts` and `.codex/tsconfig.json` into `target-project/.agent-tracer/.codex/`

The script does **not**:

- register the Codex MCP server for you
- force an already-open Codex thread to reload changed repo instructions

## 3. Register The MCP Server

```bash
codex mcp add monitor \
  --env MONITOR_BASE_URL=http://127.0.0.1:3847 \
  -- node /path/to/agent-tracer/packages/mcp/dist/index.js
```

If Codex is launched from a GUI and `node` is not on the GUI PATH, use an
absolute Node binary path instead of plain `node`.

Verify registration:

```bash
codex mcp list
```

Expected result: `monitor` is listed.

## 4. External Project Path

최신 공식 안내: https://belljun3395.github.io/agent-tracer/guide/external-setup

To attach Agent Tracer to another project:

```bash
npm run setup:external -- --target /path/to/your-project --mode codex
```

This writes two Codex-facing pieces into the target repository:

1. a managed Agent Tracer block in `AGENTS.md`
2. `.agents/skills/codex-monitor/SKILL.md`

`setup:external --mode codex` installs the Codex skill path and the Codex hook
bundle for the target repository.

If `AGENTS.md` already exists, the installer updates only the managed
`agent-tracer codex-monitor` block and leaves the rest of the file intact.

After that:

1. register the `monitor` MCP server
2. restart the Codex thread opened in the target repository
3. ask Codex to do a small task so the skill gets loaded
4. if you want hook-based tracking as well, reopen Codex in the target repo so
   the generated `.codex/config.toml` + `.codex/hooks.json` take effect

## 5. Repo-local Path In This Repository

The current recommended Codex path in this repository is:

1. register the `monitor` MCP server
2. let Codex use the repo-local `codex-monitor` skill exposed through `AGENTS.md`
3. rely on the generated native discovery path under `.agents/skills`
4. use hooks for low-level automatic tracing, and use the skill as the primary thread/topic-level semantic path

Source and generated skill files:

- `skills/codex-monitor/SKILL.md`
- `.agents/skills/codex-monitor/SKILL.md`

If the source skill changes, refresh projections:

```bash
node scripts/sync-skill-projections.mjs
```

If automatic skill triggering does not happen, invoke it explicitly in the
prompt with `$codex-monitor`.

## 6. What The Codex Skill Does

The `codex-monitor` skill:

- keeps one monitor task per Codex thread/topic by reusing a thread-local `runtimeSessionId`
- opens and closes a runtime session per turn through `runtime-session-ensure/end`
- records exploration, planning, shell validation, and notable tool usage
- records the final user-facing answer as `assistant.response` before the turn ends
- can record async/background lifecycle updates through `monitor_async_task`
- can link background/subagent work through `monitor_task_link`
- completes or errors the task explicitly only when the whole thread/topic is done

If `monitor-server` is unavailable, the skill policy is to keep working and
emit a gap report at the end instead of stopping the task.

### Assistant Response Capture

For Codex, `monitor_assistant_response` is the canonical path for final answer
text at the thread/topic level. Native hooks can also emit
`assistant.response` from `Stop.last_assistant_message`, but that path is
turn-local and does not give you the same task-reuse or semantic context model
as `codex-skill`.

That means:

- if you need one reusable task across follow-up turns, use `codex-monitor`
- if you use hooks only, you can still get `user.message`, shell activity, transcript backfill, and `assistant.response` when `Stop.last_assistant_message` is present
- if you use both hooks and the skill, expect richer coverage but separate task lineages today (`codex-hook` vs `codex-skill`)

### Recommended Operating Modes

| Mode | What you get | What you miss | Recommended use |
|------|---------------|---------------|-----------------|
| Hooks only | automatic `user.message`, Bash, transcript backfill (`web_search_end`, `apply_patch`), turn-local `assistant.response` | no thread/topic task reuse, weaker planning context | passive low-noise background tracing |
| Skill only | thread/topic task reuse, `assistant.response`, planning/context, explicit semantic events | no automatic Bash/transcript observation unless the skill records it | primary Codex tracing path |
| Hooks + skill | low-level automatic events plus semantic skill events | currently separate runtime lineages (`codex-hook`, `codex-skill`) | deep debugging when duplicate task rows are acceptable |

### Canonical Skill Sequence Per Turn

1. `monitor_runtime_session_ensure`
2. `monitor_user_message`
3. `monitor_explore` / `monitor_save_context` / `monitor_plan`
4. `monitor_terminal_command` / `monitor_tool_used` / `monitor_verify`
5. `monitor_assistant_response`
6. `monitor_runtime_session_end`

## 7. Hooks-Based Integration (Automatic Tracking)

Codex 0.x supports a native hook system that fires shell scripts at lifecycle
events. This repository includes `.codex/hooks.json` + hook scripts that track
sessions, prompts, terminal commands, and turn completion without requiring the
MCP skill to be invoked manually.

For external projects, `setup:external --mode codex` now vendors the hook
bundle into `.agent-tracer/.codex` and writes repo-local `.codex/config.toml`
plus `.codex/hooks.json` wrappers in the target repository.

### Prerequisites

Enable the feature flag in `~/.codex/config.toml` or `<repo>/.codex/config.toml`:

```toml
[features]
codex_hooks = true
```

The repo-local `.codex/config.toml` is already committed in this repository
(`agent-tracer`), but external target repositories must add their own file.

### What Each Hook Does

| Event | Hook file | What it records |
|-------|-----------|-----------------|
| `SessionStart` (startup/resume) | `session_start.ts` | Opens a runtime session, saves a planning event |
| `UserPromptSubmit` | `user_prompt.ts` | Primary path for `user.message` when the runtime emits the event |
| `PreToolUse` | `pre_tool.ts` | Ensures a runtime session/task exists |
| `PostToolUse` (Bash) | `terminal.ts` | Records the shell command with lane/semantic metadata |
| `Stop` | `stop.ts` | Backfills current-turn transcript events (`user_message`, `web_search_end`, `apply_patch`), records `assistant.response`, and marks the task complete |

Current Codex payload details and observed runtime differences are documented in
[codex-cli-hook-payload-spec.md](./codex-cli-hook-payload-spec.md).

### Hook Runner

All hooks resolve the repository root first. They prefer `git rev-parse --show-toplevel`,
fall back to the current directory when Git metadata is unavailable, and then
walk upward from `PWD` if needed to find the hook files.

Execution then uses local `node_modules/tsx` when present, otherwise `npx --yes tsx`:

```bash
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
if [ -f "$ROOT/node_modules/tsx/dist/cli.mjs" ]; then
  node "$ROOT/node_modules/tsx/dist/cli.mjs" "$ROOT/.codex/hooks/<hook>.ts"
else
  npx --yes tsx "$ROOT/.codex/hooks/<hook>.ts"
fi
```

The `MONITOR_PORT` environment variable controls which server port is targeted
(default: `3847`).

Debug logs are written to `.codex/hooks.log` when `NODE_ENV=development`.

### Hooks vs MCP Skill

| | Hooks | MCP Skill |
|-|-------|-----------|
| Setup | Automatic once `codex_hooks = true` | Must be registered via `codex mcp add` |
| Exploration/planning events | Partially captured (`SessionStart`, transcript `web_search_end`) | Captured via explicit skill calls |
| File edits (`apply_patch`) | Captured from transcript on `Stop` | Captured via `monitor_tool_used` |
| Terminal commands | Captured automatically (PostToolUse) | Via `monitor_terminal_command` |
| Assistant response text | Captured from `Stop.last_assistant_message` when present | Via `monitor_assistant_response` |
| Task lifecycle default | Current `stop.ts` marks task complete per turn | Keeps one task across turns until explicitly completed |
| Runtime source | `codex-hook` | `codex-skill` |
| Recommended for | Passive background monitoring | Full-fidelity tracing |

If hooks are not enough, or if you need semantic planning context,
question/todo/thought flows, or a canonical assistant-response path independent
from native hook payload quirks, prefer the skill as the primary path.

## 8. Manual MCP Tools

If hooks are not enough, the Codex skill path should use these MCP tools
directly.

Common lifecycle tools:

- `monitor_runtime_session_ensure`
- `monitor_runtime_session_end`
- `monitor_task_complete`
- `monitor_task_error`

Canonical conversation-boundary tools:

- `monitor_user_message`
  - use `captureMode: "raw"` and keep `messageId` stable per user turn
- `monitor_assistant_response`
  - use this immediately before the final user-facing answer
  - this is the canonical thread/topic-level path for final answer text as `assistant.response`

Common semantic logging tools:

- `monitor_explore`
- `monitor_save_context`
- `monitor_plan`
- `monitor_action`
- `monitor_terminal_command`
- `monitor_tool_used`
- `monitor_verify`
- `monitor_async_task`
- `monitor_task_link`

## 9. End-To-End Check

1. Start the monitor server.
2. Confirm `monitor` is registered in `codex mcp list`.
3. If you ran `setup:external --mode codex`, start a new Codex thread in that target repository.
4. Otherwise, start a new Codex thread in this repository.
5. Ask Codex to do a small task in the repo.
6. Continue with a follow-up prompt in the same Codex thread.
7. If you are using hooks only, confirm `codex-hook` tasks are created and that `user.message` + terminal command + `explore` (`web_search`) + `tool.used` (`apply_patch`) + `assistant.response` events arrive.
8. If you are using the MCP skill, confirm the same `codex-skill` task is reused across turns and receives `assistant.response` events.
9. If you are using both, confirm the expected split: low-level hook events under `codex-hook`, final answer text and semantic events under `codex-skill`.

# Agent Tracer - Codex Setup Guide

This guide is for Codex only.

## 1. Current Status

Supported today:

- repo-local Codex integration in this repository
- manual MCP registration
- repo-local `codex-monitor` skill discovery through `AGENTS.md`
- thread/topic-scoped task reuse through runtime session ensure/end
- canonical `assistant.response` capture through the Codex skill flow
- external-project bootstrap through `setup:external --mode codex`

Approval behavior remains a **Codex launch/runtime concern**, not a repo-local
config file concern. If you want Codex to stop prompting for approvals, use the
appropriate Codex runtime mode/flag when you launch it.

Still manual:

- global Codex MCP registration on the machine that runs Codex
- restarting the Codex thread after new repo instructions are written

## 2. What `setup:external --mode codex` Automates

The script:

- creates or updates the managed Agent Tracer block in `target-project/AGENTS.md`
- writes `target-project/.agents/skills/codex-monitor/SKILL.md`

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

If `AGENTS.md` already exists, the installer updates only the managed
`agent-tracer codex-monitor` block and leaves the rest of the file intact.

After that:

1. register the `monitor` MCP server
2. restart the Codex thread opened in the target repository
3. ask Codex to do a small task so the skill gets loaded

## 5. Repo-local Path In This Repository

The recommended Codex path in this repository is:

1. register the `monitor` MCP server
2. use `codex-monitor` as the canonical skill path
3. use `runtimeSource: "codex-skill"` for runtime session lifecycle
4. record user/assistant boundaries explicitly with `monitor_user_message` + `monitor_assistant_response`

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

- reuses one monitor task per Codex thread/topic when a stable runtime session id is available
- uses explicit `runtimeSessionId` for ensure/end calls (recommended: `CODEX_THREAD_ID`)
- when `CODEX_THREAD_ID` is missing, generate one with Node and reuse it for the same thread/topic
- opens and closes a runtime session per turn through `runtime-session-ensure/end`
- records exploration, planning, shell validation, and notable tool usage
- records the final user-facing answer as `assistant.response` before the turn ends
- can record async/background lifecycle updates through `monitor_async_task`
- can link background/subagent work through `monitor_task_link`
- completes or errors the task explicitly only when the whole thread/topic is done

If `monitor-server` is unavailable, the skill policy is to keep working and
emit a gap report at the end instead of stopping the task.

### Canonical Skill Sequence Per Turn

1. `monitor_runtime_session_ensure`
2. `monitor_user_message`
3. `monitor_explore` / `monitor_save_context` / `monitor_plan`
4. `monitor_terminal_command` / `monitor_tool_used` / `monitor_verify`
5. `monitor_assistant_response`
6. `monitor_runtime_session_end`

Recommended runtimeSessionId bootstrap:

```bash
printf '%s' "${CODEX_THREAD_ID:-}"
# if empty:
node -e "console.log('codex-' + crypto.randomUUID())"
```

## 7. Manual MCP Tools

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

## 8. End-To-End Check

1. Start the monitor server.
2. Confirm `monitor` is registered in `codex mcp list`.
3. If you ran `setup:external --mode codex`, start a new Codex thread in that target repository.
4. Otherwise, start a new Codex thread in this repository.
5. Ask Codex to do a small task in the repo.
6. Continue with a follow-up prompt in the same Codex thread.
7. Confirm the same `codex-skill` task is reused across turns.
8. Confirm `user.message`, `tool/explore/terminal`, and `assistant.response` events are recorded.

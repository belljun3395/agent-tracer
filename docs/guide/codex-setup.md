# Agent Tracer - Codex Setup Guide

This guide is for Codex only.

## 1. Current Status

Supported today:

- repo-local Codex integration in this repository
- manual MCP registration
- repo-local `codex-monitor` skill discovery through `AGENTS.md`
- thread/topic-scoped Codex task reuse through runtime session ensure/end
- manual `assistant.response` capture through the Codex skill flow
- external-project bootstrap through `setup:external --mode codex`

Still manual:

- global Codex MCP registration on the machine that runs Codex
- restarting the Codex thread after new repo instructions are written

## 2. Register The MCP Server

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

## 3. External Project Path

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

## 4. Repo-local Path In This Repository

The current recommended Codex path in this repository is:

1. register the `monitor` MCP server
2. let Codex use the repo-local `codex-monitor` skill exposed through `AGENTS.md`
3. rely on the generated native discovery path under `.agents/skills`

Source and generated skill files:

- `skills/codex-monitor/SKILL.md`
- `.agents/skills/codex-monitor/SKILL.md`

If the source skill changes, refresh projections:

```bash
node scripts/sync-skill-projections.mjs
```

If automatic skill triggering does not happen, invoke it explicitly in the
prompt with `$codex-monitor`.

## 5. What The Codex Skill Does

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

## 6. End-To-End Check

1. Start the monitor server.
2. Confirm `monitor` is registered in `codex mcp list`.
3. If you ran `setup:external --mode codex`, start a new Codex thread in that target repository.
4. Otherwise, start a new Codex thread in this repository.
5. Ask Codex to do a small task in the repo.
6. Continue with a follow-up prompt in the same Codex thread.
7. Confirm the same monitor task is reused across turns and receives both `user.message` and `assistant.response` events.

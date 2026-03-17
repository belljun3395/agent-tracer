# Agent Tracer - Codex Setup Guide

This guide is for Codex only.

As of March 16, 2026, the most reliable Codex path in this repository is:

1. register the `monitor` MCP server
2. let Codex use the repo-local `codex-monitor` skill exposed through `AGENTS.md`

## 1. Verify The Monitor Server

```bash
curl -sf http://127.0.0.1:${MONITOR_PORT:-3847}/api/overview | python3 -m json.tool
```

If the request fails, start the server:

```bash
npm run dev:server
# or
npm run build && npm run start:server
```

## 2. Register The MCP Server

```bash
codex mcp add monitor \
  --env MONITOR_BASE_URL=http://127.0.0.1:3847 \
  -- node /path/to/agent-tracer/packages/mcp/dist/index.js
```

If Codex is launched from a GUI app and `node` is managed outside the GUI PATH,
prefer an absolute node path:

```bash
codex mcp add monitor \
  --env MONITOR_BASE_URL=http://127.0.0.1:3847 \
  -- /absolute/path/to/node /path/to/agent-tracer/packages/mcp/dist/index.js
```

Verify registration:

```bash
codex mcp list
```

Expected result: `monitor` is listed.

## 3. Use The Repo-Local Codex Skill

This repository ships a Codex skill at:

- `skills/codex-monitor/SKILL.md`

The repository root `AGENTS.md` advertises this skill so future Codex sessions in
this checkout can trigger it automatically.

What the skill does:

- starts one monitor task per user request
- records exploration, planning, shell validation, and notable tool usage
- can record async/background lifecycle updates through `monitor_async_task`
- completes or errors the task explicitly

What you need to do:

1. Keep the `monitor` MCP server registered.
2. Start a new Codex thread after pulling these changes so `AGENTS.md` is reloaded.
3. Work normally in this repository.

If automatic skill triggering does not happen, invoke it explicitly in the user
prompt with `$codex-monitor`.

## 4. End-To-End Check

1. Start the monitor server.
2. Confirm `monitor` is registered in `codex mcp list`.
3. Start a new Codex thread in this repository.
4. Ask Codex to do a small task in the repo.
5. Confirm a monitor task appears in the dashboard and receives multiple events.

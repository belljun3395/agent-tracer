# Agent Tracer - Codex Setup Guide

This guide is for Codex only.

Unlike Claude Code and OpenCode, Codex does **not** currently have a
`setup:external` installer in this repository. If your goal is to attach Agent
Tracer to another project, treat this page as a manual reference rather than an
automated path.

## 1. Current Status

Supported today:

- repo-local Codex integration in this repository
- manual MCP registration
- repo-local `codex-monitor` skill discovery through `AGENTS.md`

Not automated yet:

- writing Codex-specific config into another target project
- generating a target-project `AGENTS.md` and skill projection automatically

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

## 3. Repo-local Path In This Repository

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

## 4. Manual External Path

If you want to experiment with Codex in another project today, you need to
manually recreate the same pieces:

1. register the `monitor` MCP server
2. make the target repository advertise an Agent Tracer monitoring skill through its own `AGENTS.md`
3. expose a Codex-readable skill projection in the target repository
4. restart the Codex thread so the new instructions are loaded

This repository does not yet provide a one-command external Codex installer.

## 5. What The Repo-local Skill Does

The `codex-monitor` skill:

- starts one monitor task per user request
- records exploration, planning, shell validation, and notable tool usage
- can record async/background lifecycle updates through `monitor_async_task`
- can link background/subagent work through `monitor_task_link`
- completes or errors the task explicitly

If `monitor-server` is unavailable, the skill policy is to keep working and
emit a gap report at the end instead of stopping the task.

## 6. End-To-End Check

1. Start the monitor server.
2. Confirm `monitor` is registered in `codex mcp list`.
3. Start a new Codex thread in this repository.
4. Ask Codex to do a small task in the repo.
5. Confirm a monitor task appears in the dashboard and receives multiple events.

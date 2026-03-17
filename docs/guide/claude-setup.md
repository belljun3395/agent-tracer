# Agent Tracer - Claude Code Setup Guide

This guide is for Claude Code only.

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
claude mcp add monitor node /path/to/packages/mcp/dist/index.js
```

To use a custom monitor URL:

```bash
claude mcp add monitor \
  -e MONITOR_BASE_URL=http://127.0.0.1:3847 \
  node /path/to/packages/mcp/dist/index.js
```

Verify registration:

```bash
claude mcp list
```

Expected result: `monitor` is listed and connected.

## 3. Claude Hook Setup In This Repository

Claude reads `.claude/settings.json`, which already points at the repository
hook scripts.

Configured hook files:

- `.claude/hooks/ensure_task.py`
- `.claude/hooks/terminal.py`
- `.claude/hooks/tool_used.py`
- `.claude/hooks/explore.py`
- `.claude/hooks/session_stop.py`

Behavior in this repository:

- create a task on first tool use
- capture Bash activity
- capture Edit and Write activity
- capture Read, Glob, Grep, LS, WebSearch, and WebFetch exploration
- complete the task on stop

No extra Claude-specific setup is required if you are working in this checkout.

## 4. Reuse Claude Hooks In Another Project

Copy both the settings file and the hook scripts:

```bash
cp -r /path/to/agent-tracer/.claude/hooks /your-project/.claude/hooks
cp /path/to/agent-tracer/.claude/settings.json /your-project/.claude/settings.json
```

Then register the same `monitor` MCP server in Claude Code.

## 5. Manual MCP Tools

If hooks are not enough, call the MCP tools directly:

- `monitor_task_start`
- `monitor_task_complete`
- `monitor_task_error`
- `monitor_tool_used`
- `monitor_terminal_command`
- `monitor_save_context`
- `monitor_plan`
- `monitor_action`
- `monitor_verify`
- `monitor_rule`
- `monitor_explore`
- `monitor_async_task`

## 6. End-To-End Check

1. Start the monitor server.
2. Open Claude Code in this repository.
3. Perform one read or edit action.
4. Confirm the task appears in the dashboard.
5. Stop the session and confirm the task updates.

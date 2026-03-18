# Agent Tracer - Claude Code Setup Guide

This guide is for Claude Code only.

If you want to attach Agent Tracer to another project, start with
[external-setup.md](./external-setup.md) first. This page covers the
Claude-specific steps after the shared setup flow.

## 1. What `setup:external --mode claude` automates

The script:

- creates or merges `target-project/.claude/settings.json`
- points the hook commands back to `agent-tracer/.claude/hooks/*.py` by absolute path
- keeps the hook implementation in this repository

The script does **not**:

- register the Claude MCP server for you
- copy the Python hook implementation into the target project

## 2. Verify The Monitor Server

```bash
curl -sf http://127.0.0.1:${MONITOR_PORT:-3847}/api/overview | python3 -m json.tool
```

If the request fails, start the server:

```bash
npm run dev:server
# or
npm run build && npm run start:server
```

## 3. External Project Setup

From the Agent Tracer repository root:

```bash
npm run build
npm run setup:external -- --target /path/to/your-project --mode claude
```

Then register the same `monitor` MCP server in Claude Code:

```bash
claude mcp add monitor \
  -e MONITOR_BASE_URL=http://127.0.0.1:3847 \
  node /absolute/path/to/agent-tracer/packages/mcp/dist/index.js
```

If Claude is launched from a GUI and `node` is not on the GUI PATH, use an
absolute Node binary path instead of plain `node`.

Verify registration:

```bash
claude mcp list
```

Expected result: `monitor` is listed and connected.

## 4. What The Hooks Do

Configured hook files in this repository:

- `.claude/hooks/session_start.py`
- `.claude/hooks/user_prompt.py`
- `.claude/hooks/ensure_task.py`
- `.claude/hooks/terminal.py`
- `.claude/hooks/tool_used.py`
- `.claude/hooks/explore.py`
- `.claude/hooks/agent_activity.py`
- `.claude/hooks/session_stop.py`

Behavior:

- create or resume a runtime session through `/api/runtime-session-ensure`
- capture raw user prompt text via `UserPromptSubmit`
- capture Bash, edit, write, and exploration activity
- capture Agent and Skill activity
- end only the current session on stop, not the entire work item

**Session vs. task lifecycle:**

| Event | Hook | Effect |
|-------|------|--------|
| Session start / first prompt | `session_start.py`, `user_prompt.py` | Ensure runtime task + record raw user prompt |
| First tool use | `ensure_task.py` | Reuses the ensured runtime session |
| Session stop | `session_stop.py` | Ends only the current session |
| Work item complete | `monitor_task_complete` MCP tool | Marks the task `completed` |

## 5. Repo-local Setup In This Repository

If you are working inside this repository, `.claude/settings.json` already
points at the repository hook scripts. No extra Claude hook wiring is required.

You still need the `monitor` MCP server registered in Claude Code.

## 6. Manual MCP Tools

If hooks are not enough, you can still call MCP tools directly.

Common lifecycle tools:

- `monitor_task_start`
- `monitor_task_complete`
- `monitor_task_error`
- `monitor_session_end`

Canonical user message path:

- `monitor_user_message`
  - `messageId` is required
  - `captureMode: "derived"` requires `sourceEventId`

Planning / event logging tools:

- `monitor_save_context`
- `monitor_tool_used`
- `monitor_terminal_command`
- `monitor_plan`
- `monitor_action`
- `monitor_verify`
- `monitor_rule`
- `monitor_explore`
- `monitor_async_task`

## 7. End-To-End Check

1. Start the monitor server.
2. Run `setup:external --mode claude` for the target project.
3. Register `monitor` in `claude mcp add`.
4. Open the target project in Claude Code.
5. Perform one read or edit action.
6. Confirm a task appears in the dashboard.
7. Stop the Claude session and confirm the task remains open for follow-up turns.

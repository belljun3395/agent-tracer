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

- create a task on first tool use of a new session
- resume an existing work item when the previous session ended normally
  (`.current-task-id` retains the task ID between sessions)
- capture Bash activity
- capture Edit and Write activity
- capture Read, Glob, Grep, LS, WebSearch, and WebFetch exploration
- end only the current session on stop — the work item stays open for follow-up turns
- record an explicit `user-message-capture-unavailable` signal each session because
  Claude Code hook payloads do not expose raw user prompt text

**Session vs. task lifecycle:**

| Event | Hook | Effect |
|-------|------|--------|
| First tool use (no task file) | `ensure_task.py` | New task + new session |
| First tool use (task file with cleared session) | `ensure_task.py` | New session under same task |
| Session stop | `session_stop.py` | Session ended; task stays `running` |
| Work item complete | `monitor_task_complete` MCP tool | Task marked `completed` |

Raw user prompt text is **not available** from Claude Code hooks. The hooks
record a `rule.logged` event with `ruleId: user-message-capture-unavailable`
to make this gap explicit in the timeline. To record actual user messages,
call `monitor_user_message` directly via MCP.

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

**Lifecycle:**
- `monitor_task_start` — start or resume a work item
- `monitor_task_complete` — explicitly close the work item
- `monitor_task_error` — record a failure
- `monitor_session_end` — end the current session without closing the work item

**Canonical user message (raw prompt path):**
- `monitor_user_message` — record a user.message event (`captureMode: "raw"` or `"derived"`)
  - `messageId` is required for deduplication
  - `captureMode: "derived"` requires `sourceEventId` linking to the raw source event
  - `source: "claude-hook"` requires `sessionId`

**Planning checkpoints (not raw prompts):**
- `monitor_save_context` — planning thought, analysis, or context snapshot

**Event logging:**
- `monitor_tool_used`
- `monitor_terminal_command`
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
5. Stop the session — the task should remain `running` (not `completed`).
6. Reopen Claude Code and perform another action.
7. Confirm the same task in the dashboard now has two sessions under it.
8. Call `monitor_task_complete` via MCP to explicitly close the work item.

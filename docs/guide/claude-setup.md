# Agent Tracer - Claude Code Setup Guide

This guide is for Claude Code only.

> **Server note:** `packages/server` is a generic runtime monitor. It exposes
> `POST /api/runtime-session-ensure` and `POST /api/runtime-session-end` as
> stateless runtime helpers that any adapter can call. The Claude hooks use
> these endpoints with `runtimeSource: "claude-hook"`. Legacy compatibility
> wrappers `POST /api/cc-session-ensure` and `POST /api/cc-session-end` still
> exist but are temporary shims — new integrations should use the generic
> `runtime-session-*` endpoints.

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
AGENT_TRACER=/path/to/agent-tracer
YOUR_PROJECT=/your-project

mkdir -p "$YOUR_PROJECT/.claude"
cp -r "$AGENT_TRACER/.claude/hooks"       "$YOUR_PROJECT/.claude/hooks"
cp    "$AGENT_TRACER/.claude/settings.json" "$YOUR_PROJECT/.claude/settings.json"
```

Then register the same `monitor` MCP server in Claude Code:

```bash
claude mcp add monitor \
  -e MONITOR_BASE_URL=http://127.0.0.1:3847 \
  node /absolute/path/to/agent-tracer/packages/mcp/dist/index.js
```

**OpenCode와 동시 사용 시:** `settings.json`의 모든 훅 커맨드 앞에는 아래 가드가 붙어 있습니다.

```bash
[ -n "$OPENCODE" ] || [ -n "$OPENCODE_CLIENT" ] || python3 .claude/hooks/...
```

이 조건은 OpenCode 환경(`$OPENCODE` 환경변수가 설정된 경우)에서는 훅 스크립트를 건너뛰도록
설계된 것입니다. OpenCode는 `.opencode/plugins/monitor.ts` 플러그인이 모니터링을 처리하므로
Claude 훅이 중복 실행되지 않습니다. 두 도구를 같은 프로젝트에서 쓸 때 이 가드가 충돌을 방지합니다.

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
  - `runtimeSource: "claude-hook"` path requires `sessionId` (always provided by hooks)

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

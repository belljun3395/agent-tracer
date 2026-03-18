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

- `.claude/hooks/session_start.py`
- `.claude/hooks/user_prompt.py`
- `.claude/hooks/ensure_task.py`
- `.claude/hooks/terminal.py`
- `.claude/hooks/tool_used.py`
- `.claude/hooks/explore.py`
- `.claude/hooks/agent_activity.py`
- `.claude/hooks/session_stop.py`

Behavior in this repository:

- create or resume a runtime session through `/api/runtime-session-ensure`
- capture raw user prompt text via `UserPromptSubmit`
- capture Bash activity
- capture Edit and Write activity
- capture Read, Glob, Grep, LS, WebSearch, and WebFetch exploration
- capture Agent and Skill activity
- end only the current session on stop — the work item stays open for follow-up turns
- emit `user-message-capture-unavailable` only if a future Claude payload omits raw prompt text

**Session vs. task lifecycle:**

| Event | Hook | Effect |
|-------|------|--------|
| Session start / first prompt | `session_start.py`, `user_prompt.py` | Ensure runtime task + record raw user prompt |
| First tool use | `ensure_task.py` | Reuses ensured runtime session |
| Session stop | `session_stop.py` | Session ended; task stays `running` |
| Work item complete | `monitor_task_complete` MCP tool | Task marked `completed` |

Raw user prompt text **is available in this repository’s hook setup** through
`UserPromptSubmit`. If a Claude payload arrives without raw prompt text in a
future runtime variant, the fallback remains `monitor_rule` with
`ruleId: user-message-capture-unavailable`.

Native Claude skill projection is available at:

- `.claude/skills/agent-tracer-monitor/SKILL.md`

This is a fallback/manual discovery aid only. Hook-based automatic monitoring
remains the primary Claude path.

No extra Claude-specific setup is required if you are working in this checkout.

## 4. Reuse Claude Hooks In Another Project

외부 프로젝트에서는 Python 훅 파일을 복사하지 말고,
설치 스크립트로 **절대 경로 참조형 hooks 설정**을 생성하세요.

```bash
cd /path/to/agent-tracer
npm run setup:external -- --target /path/to/your-project --mode claude
```

이 스크립트는 `/path/to/your-project/.claude/settings.json`을 생성/병합하며,
각 hook command가 `agent-tracer/.claude/hooks/*.py`를 절대 경로로 실행하도록 설정합니다.
즉, 외부 프로젝트에 Python 구현 파일을 복사하지 않습니다.

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
  - `source: "claude-hook"` path requires `sessionId` (always provided by hooks)

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

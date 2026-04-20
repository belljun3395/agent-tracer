# Runtime API Flow & Preprocessing

The automatic runtime currently implemented in the repository is the Claude Code plugin.
This document is an operational reference explaining what preprocessing the Claude plugin performs
before calling Agent Tracer API, and how manual runtimes should follow the same surface.

Implementation basis:
- Claude plugin hooks: `packages/runtime/src/claude-code/hooks/*.ts`
- Public API surface: `packages/server/src/presentation/controllers/*.ts`

Related documentation:
- [API integration map](./api-integration-map.md)
- [Claude hook payload spec](./hook-payload-spec.md)

## API Roles

| API | Core Role |
|---|---|
| `/api/runtime-session-ensure` | Runtime session upsert + task/session binding |
| `/api/runtime-session-end` | Runtime session closure |
| `/api/user-message` | Store user raw prompt |
| `/api/assistant-response` | Store assistant final response |
| `/api/tool-used` | Record implementation action |
| `/api/explore` | Record exploration/lookup |
| `/api/terminal-command` | Record shell execution |
| `/api/agent-activity` | Record delegation/skill/MCP calls |
| `/api/todo` | Track todo lifecycle |
| `/api/task-link` | Link parent-child tasks |
| `/api/async-task` | Background task state |
| `/api/save-context`, `/api/plan`, `/api/action`, `/api/verify`, `/api/rule`, `/api/question`, `/api/thought` | High-signal structured events |

## Claude Plugin Preprocessing Strategy

### Input Normalization

- Reads hook stdin JSON; treats non-objects as empty object.
- Claude payload `hook_source` still comes as `"claude-hook"` value; only allows this value to block contaminated events.
- Canonical `runtimeSource` sent to server is `claude-plugin`.
- Strings are normalized with trim + maxLength cutoff.

### Session Prerequisite Guarantee

- Calls `runtime-session-ensure` first from `SessionStart`, `UserPromptSubmit`, `PreToolUse` series.
- User prompt is filtered for closure commands like `/exit`, then saved to `/api/user-message`.

### Tool Event Classification

- Routes to `/api/tool-used`, `/api/explore`, `/api/terminal-command`, `/api/agent-activity` based on `tool_name` and `tool_input`.
- MCP-format tools (`mcp__...`) are converted to `activityType: "mcp_call"`.
- Bash is semantically classified by command meaning with enriched semantic metadata.
- `Agent` / `Skill` / subagent lifecycle is linked to `/api/agent-activity`, `/api/task-link`, `/api/async-task`.

### Assistant Response Boundary

- `Stop` hook reads final assistant message and token usage, sending to `/api/assistant-response`.
- `SessionEnd` and `Stop` conditionally call `/api/runtime-session-end` to close session, but do not auto-complete primary task.

## Representative JSON Examples

### `UserPromptSubmit` → `/api/user-message`

```json
{
  "taskId": "task_01J...",
  "sessionId": "sess_01J...",
  "messageId": "msg_1712345678901_ab12cd",
  "captureMode": "raw",
  "source": "claude-plugin",
  "title": "Organize documentation structure and add API flow diagram",
  "body": "Organize documentation structure and add API flow diagram"
}
```

### `PostToolUse(Bash)` → `/api/terminal-command`

```json
{
  "taskId": "task_01J...",
  "sessionId": "sess_01J...",
  "command": "npm test",
  "title": "npm test",
  "body": "npm test",
  "lane": "implementation",
  "metadata": {
    "command": "npm test",
    "subtypeKey": "run_test",
    "toolFamily": "terminal",
    "sourceTool": "Bash"
  }
}
```

### `Stop` → `/api/assistant-response`

```json
{
  "taskId": "task_01J...",
  "sessionId": "sess_01J...",
  "messageId": "msg_1712345678999_f3e2aa",
  "source": "claude-plugin",
  "title": "Updated the documentation as requested.",
  "body": "Updated the documentation as requested.",
  "metadata": {
    "stopReason": "end_turn",
    "inputTokens": 1200,
    "outputTokens": 430
  }
}
```

### `SessionEnd` / `Stop` → `/api/runtime-session-end`

```json
{
  "runtimeSource": "claude-plugin",
  "runtimeSessionId": "claude-session-abc",
  "completionReason": "assistant_turn_complete",
  "summary": "Updated the documentation as requested."
}
```

## Minimum Rules Manual Runtime Must Follow

Runtimes without automatic plugins can use the same dashboard/storage by following the sequence below.

1. If stable session ID available, call `/api/runtime-session-ensure`
2. For each user input, call `/api/user-message`
3. For each tool use, call `/api/tool-used` or `/api/explore`
4. On response completion, call `/api/assistant-response`
5. At turn end, call `/api/runtime-session-end` or `/api/session-end`

Optionally add `/api/todo`, `/api/agent-activity`, `/api/async-task`, `/api/task-link`,
`/api/save-context`, `/api/plan`, `/api/action`, `/api/verify`, `/api/rule`, `/api/question`, `/api/thought`
as needed.

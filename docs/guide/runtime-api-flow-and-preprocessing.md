# Runtime API Flow & Preprocessing

The automatic runtimes currently implemented in the repository are the Claude Code plugin
and the Codex hook adapter. This document is an operational reference explaining what
preprocessing those adapters perform before calling Agent Tracer API, and how manual
runtimes should follow the same surface.

Implementation basis:
- Claude plugin hooks: `packages/runtime/src/claude-code/hooks/*.ts`
- Codex hook adapter: `packages/runtime/src/codex/hooks/*.ts`
- Public API surface: `packages/server/src/adapters/http/ingest/controllers/lifecycle.controller.ts`

Related documentation:
- [API integration map](./api-integration-map.md)
- [Claude hook payload spec](./hook-payload-spec.md)

## API Roles

| API | Core Role |
|---|---|
| `/ingest/v1/sessions/ensure` | Runtime session upsert + task/session binding |
| `/ingest/v1/sessions/end` | Runtime session closure |
| `/ingest/v1/tasks/complete`, `/ingest/v1/tasks/error` | Direct task finalization by task id |
| `/ingest/v1/conversation` | Store user raw prompt |
| `/ingest/v1/conversation` (`assistant.response`) | Store assistant final response |
| `/ingest/v1/tool-activity` | Record implementation action |
| `/ingest/v1/tool-activity` | Record exploration/lookup |
| `/ingest/v1/tool-activity` | Record shell execution |
| `/ingest/v1/coordination` | Record delegation/skill/MCP calls |
| `/ingest/v1/workflow` | Track todo lifecycle |
| `/ingest/v1/tasks/link` | Link parent-child tasks |
| `/ingest/v1/coordination` | Background task state |
| `/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/conversation`, `/ingest/v1/workflow` | High-signal structured events |

## Claude Plugin Preprocessing Strategy

### Input Normalization

- Every hook reads stdin via the shared `runHook()` wrapper
  (`packages/runtime/src/shared/hook-runtime/run-hook.ts`). Non-JSON /
  non-object payloads become an empty object; the hook exits 0 without
  blocking Claude Code.
- Per-event payload readers under `packages/runtime/src/shared/hooks/claude/payloads.ts`
  enforce required fields (`session_id`, etc.) and expose typed
  `agentId` / `model` / `permissionMode` / `transcriptPath` / `cwd`.
- Claude payload `hook_source` still comes as `"claude-hook"`; only that
  value is treated as a valid Claude event.
- Canonical `runtimeSource` sent to server is `claude-plugin`.
- Strings are normalized with trim + maxLength cutoff inside the readers.

### Session Prerequisite Guarantee

- Calls `runtime-session-ensure` first from `SessionStart`,
  `UserPromptSubmit`, `PreToolUse`, `SubagentStart`, and the status-line
  path.
- User prompt is filtered for closure commands like `/exit`, then saved to `/ingest/v1/conversation`.

### Tool Event Classification

- Each official Claude tool has its own file under `PostToolUse/` (e.g.
  `Bash.ts`, `Edit.ts`, `Read.ts`, `Agent.ts`, `Skill.ts`, `TaskCreate.ts`,
  …). Shared per-category logic lives in `_file.ops.ts`,
  `_explore.ops.ts`, `_agent.ops.ts`, `_skill.ops.ts`, `_todo.ops.ts`.
- Routes to `/ingest/v1/tool-activity`, `/ingest/v1/tool-activity`, `/ingest/v1/tool-activity`,
  `/ingest/v1/coordination`, `/ingest/v1/workflow` based on which ops module handled the event.
- MCP-format tools (`mcp__...`) are handled by the `Mcp.ts` category
  handler (the only grouped file, since `mcp__*` is a wildcard regex) and
  are converted to `activityType: "mcp_call"`.
- Bash is semantically classified by command meaning with enriched semantic metadata.
- `Agent` / `Skill` / subagent lifecycle is linked to `/ingest/v1/coordination`,
  `/ingest/v1/tasks/link`, `/ingest/v1/coordination`.
- Parallel tool fan-outs are bounded by `PostToolBatch` posting a
  `context.saved` marker (`trigger: "tool_batch_completed"`).
- Tool-call auto-denials from `PermissionDenied` post a `rule.logged`
  event with `ruleOutcome: "auto_deny"`.

### Assistant Response Boundary

- `Stop` hook reads the final assistant message and sends an `assistant.response` event to `/ingest/v1/conversation`.
- `StopFailure` posts an `assistant.response` with
  `stopReason: "error:<error_type>"` whenever a turn fails to complete
  due to `rate_limit`, `authentication_failed`, `billing_error`,
  `invalid_request`, `server_error`, `max_output_tokens`, or `unknown`.
- Token/context telemetry is collected by runtime-specific telemetry paths, not by the lifecycle API itself.
- `Stop` calls `/ingest/v1/sessions/end` with `completeTask: true` and `completionReason: "assistant_turn_complete"`.
- `SessionEnd` only passes `completeTask: true` for an explicit user exit; runtime termination/resume closes the monitor session without completing the primary task.
- The server will not complete a primary task while background descendants are still running; in that case it moves the primary task to `waiting`.

### Transport Error Surface

- `postJson` throws `MonitorRequestError(status, pathname, code?, details?)`
  when the monitor returns a non-2xx response, preserving the server
  envelope's `error.code` / `error.message` / `error.details`. The shared
  `runHook()` wrapper logs the error and exits 0; Claude is never blocked.

## Representative JSON Examples

### `UserPromptSubmit` → `/ingest/v1/conversation`

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

### `PostToolUse(Bash)` → `/ingest/v1/tool-activity`

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

> **Rule lane reclassification:** At `/ingest/v1/tool-activity`, `terminal.command` events are
> checked against user-defined rule patterns stored in the `rule_commands` table (global +
> task-scoped). If the command string contains a matching pattern (case-insensitive substring),
> the event's `lane` is replaced with `"rule"` before persistence. The plugin itself always
> emits `"exploration"` or `"implementation"`; the `"rule"` lane is assigned exclusively
> server-side. See [API integration map § Rule Commands](./api-integration-map.md#rule-commands).

### `Stop` → `/ingest/v1/conversation` (`assistant.response`)

```json
{
  "events": [
    {
      "kind": "assistant.response",
      "lane": "user",
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
  ]
}
```

### `SessionEnd` / `Stop` → `/ingest/v1/sessions/end`

```json
{
  "runtimeSource": "claude-plugin",
  "runtimeSessionId": "claude-session-abc",
  "completionReason": "assistant_turn_complete",
  "completeTask": true,
  "summary": "Updated the documentation as requested."
}
```

### Direct task finalization

Use these endpoints only when the caller already knows the monitor `taskId` and
wants to finalize that task directly. Do not send runtime-session policy fields
(`completeTask`, `completionReason`, `backgroundCompletions`) here; those are
only meaningful for `/ingest/v1/sessions/end`.

```json
{
  "taskId": "task_01J...",
  "sessionId": "sess_01J...",
  "summary": "Work item completed.",
  "metadata": {
    "source": "manual"
  }
}
```

For task failure, call `/ingest/v1/tasks/error` with the same base fields plus
`errorMessage`.

## Minimum Rules Manual Runtime Must Follow

Runtimes without automatic plugins can use the same dashboard/storage by following the sequence below.

1. If stable session ID available, call `/ingest/v1/sessions/ensure`
2. For each user input, call `/ingest/v1/conversation`
3. For each tool use, call `/ingest/v1/tool-activity` or `/ingest/v1/tool-activity`
4. On response completion, send an `assistant.response` event to `/ingest/v1/conversation`
5. At turn end, call `/ingest/v1/sessions/end`; pass `completeTask: true` only when the runtime is declaring the work item done

Optionally add `/ingest/v1/workflow`, `/ingest/v1/coordination`, `/ingest/v1/coordination`, `/ingest/v1/tasks/link`,
`/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/workflow`, `/ingest/v1/conversation`, `/ingest/v1/workflow`
as needed.

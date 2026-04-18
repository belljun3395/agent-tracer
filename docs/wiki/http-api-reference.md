# HTTP API Reference

The Agent Tracer server is divided into admin/read API, lifecycle API, event ingestion API,
bookmark API, search API, and workflow library API.
The current HTTP surface is implemented as a NestJS controller,
with actual semantics converging in a single `MonitorService`.

## Core Files

- `packages/adapter-http-query/src/admin.controller.ts`
- `packages/adapter-http-query/src/bookmark.controller.ts`
- `packages/adapter-http-query/src/search.controller.ts`
- `packages/adapter-http-query/src/evaluation.controller.ts`
- `packages/adapter-http-ingest/src/lifecycle.controller.ts`
- `packages/adapter-http-ingest/src/event.controller.ts`
- `packages/adapter-http-ingest/src/ingest.controller.ts`
- `packages/adapter-http-ingest/src/bookmark-write.controller.ts`
- `packages/adapter-http-ingest/src/evaluation-write.controller.ts`
- `packages/adapter-http-ingest/src/schemas.ts`
- `packages/adapter-http-ingest/src/schemas.ingest.ts`
- `packages/application/src/services/event-ingestion-service.ts`

## 1. Admin / Read API

- `GET /health`
- `GET /api/overview`
- `GET /api/tasks`
- `GET /api/default-workspace`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/:taskId/observability`
- `GET /api/tasks/:taskId/openinference`
- `GET /api/observability/overview`

## 2. Lifecycle API

Routes where state transitions (creation, termination, linking, etc.) are explicit.
These routes are not integrated into event ingestion.

- `POST /api/task-start`
- `POST /api/task-link`
- `POST /api/task-complete`
- `POST /api/task-error`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/finished`
- `DELETE /api/tasks/:taskId`
- `POST /api/session-end`
- `POST /api/runtime-session-ensure`
- `POST /api/runtime-session-end`

## 3. Unified Event Ingestion API (Recommended)

As of v0.1.4, new clients send all events to a single endpoint.

### `POST /ingest/v1/events`

```http
POST /ingest/v1/events
Content-Type: application/json

{
  "events": [
    {
      "kind": "tool.used",
      "taskId": "...",
      "sessionId": "...",
      "toolName": "Edit",
      "title": "Edit: foo.ts",
      "lane": "implementation",
      "metadata": { ... }
    }
  ]
}
```

Up to 100 events can be sent in a batch at once.
Each event is dispatched based on its `kind` field.

#### Supported kind List

| kind | Description |
|------|-------------|
| `tool.used` | File edit, tool usage (exploration distinguished by lane field) |
| `terminal.command` | Bash command execution |
| `context.saved` | Context compression/saving (compaction, session start) |
| `plan.logged` | Plan phase logging |
| `action.logged` | Action logging; if `asyncTaskId` present, async lifecycle |
| `verification.logged` | Verification result logging |
| `rule.logged` | Rule/policy application logging |
| `agent.activity.logged` | Logging delegation, skill_use, mcp_call |
| `user.message` | User input |
| `question.logged` | Question flow |
| `todo.logged` | Todo item status change |
| `thought.logged` | Summary thought/reasoning logging |
| `assistant.response` | Assistant response |

#### Response

```json
{
  "ok": true,
  "data": {
    "accepted": [{ "eventId": "...", "kind": "tool.used", "taskId": "..." }],
    "rejected": []
  }
}
```

On validation failure: `400` + `{ ok: false, error: { code, message, details } }`.

#### Schema location

- Request schema: `packages/adapter-http-ingest/src/schemas.ingest.ts`
- Service dispatch: `packages/application/src/services/event-ingestion-service.ts`

## 4. Legacy Event Logging API (Backward Compatibility)

Individual endpoints remain for existing clients.
New clients are recommended to use `/ingest/v1/events`.

- `POST /api/tool-used`
- `POST /api/terminal-command`
- `POST /api/save-context`
- `POST /api/explore`
- `POST /api/plan`
- `POST /api/action`
- `POST /api/verify`
- `POST /api/rule`
- `POST /api/async-task`
- `POST /api/agent-activity`
- `POST /api/user-message`
- `POST /api/question`
- `POST /api/todo`
- `POST /api/thought`
- `POST /api/assistant-response`
- `PATCH /api/events/:eventId`

## 5. Bookmark / Search API

- `GET /api/bookmarks`
- `POST /api/bookmarks`
- `DELETE /api/bookmarks/:bookmarkId`
- `GET /api/search`

## 6. Workflow Library API

- `POST /api/tasks/:id/evaluate`
- `GET /api/tasks/:id/evaluate`
- `GET /api/workflows`
- `GET /api/workflows/similar`
- `GET /api/workflows/:id/content`

## Request Validation

All write paths validate request body through Zod schema.
`/ingest/v1/events` uses `ingestEventsBatchSchema` (schemas.ingest.ts),
while legacy paths use `presentation/schemas.ts`.

## Related Documentation

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)

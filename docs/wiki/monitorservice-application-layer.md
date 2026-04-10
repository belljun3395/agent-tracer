# MonitorService: Application Layer

`MonitorService` is an application service that handles nearly all major use cases of the current server.
Most requests from task start through workflow evaluation search eventually flow into this class.

## Core Files

- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/types.ts`
- `packages/server/src/application/services/event-ingestion-service.ts` — unified ingestion entry point
- `packages/server/src/application/services/event-recorder.ts`
- `packages/server/src/application/services/session-lifecycle-policy.ts`
- `packages/server/src/application/services/trace-metadata-factory.ts`
- `packages/server/src/application/services/task-display-title-resolver.helpers.ts`
- `packages/server/src/application/services/task-display-title-resolver.constants.ts`
- `packages/server/src/application/services/event-recorder.helpers.ts`
- `packages/server/src/application/services/trace-metadata-factory.helpers.ts`
- `packages/server/src/application/workflow-context-builder.constants.ts`

## Key Responsibilities

### Task/session lifecycle

- `startTask()`
- `completeTask()`
- `errorTask()`
- `endSession()`
- `ensureRuntimeSession()`
- `endRuntimeSession()`
- `linkTask()`

These routes handle task state, running session count, and background lineage together.

### Event logging

External clients (hooks, MCP tools) do not directly call `MonitorService` methods.
The flow is: `POST /ingest/v1/events` → `EventIngestionService.ingest()` → `MonitorService.log*()`.

`EventIngestionService` dispatches based on the `kind` field and calls the following methods:

- `logToolUsed()` — `kind: "tool.used"`
- `logExploration()` — `kind: "tool.used"` + `lane: "exploration"`
- `logTerminalCommand()` — `kind: "terminal.command"`
- `saveContext()` — `kind: "context.saved"`
- `logPlan()` — `kind: "plan.logged"`
- `logAction()` — `kind: "action.logged"` (when asyncTaskId is absent)
- `logAsyncLifecycle()` — `kind: "action.logged"` + `asyncTaskId` present
- `logVerification()` — `kind: "verification.logged"`
- `logRule()` — `kind: "rule.logged"`
- `logAgentActivity()` — `kind: "agent.activity.logged"`
- `logUserMessage()` — `kind: "user.message"`
- `logQuestion()` — `kind: "question.logged"`
- `logTodo()` — `kind: "todo.logged"`
- `logThought()` — `kind: "thought.logged"`
- `logAssistantResponse()` — `kind: "assistant.response"`

### SessionId Combination Rules

`MonitorService` handles event logging input in two ways:

- `user.message` series requires `sessionId`, so it is used directly.
- Some events like `assistant.response`, `question`, `todo`, `thought`, and `tool-used` 
  may omit `sessionId`. When omitted, `resolveSessionId(taskId, sessionId)` queries
  the task's current active session.
- When including in actual event payload, the common helper `withSessionId()` ensures
  unified recording as `...(resolvedSessionId ? { sessionId: resolvedSessionId } : {})`.

This rule ensures consistent session binding, especially for events like `question`, `todo`, and `thought`
where context-based calls from the runtime are frequent.

Actual event insertion is handled by `EventRecorder`, while `MonitorService` coordinates
use cases and lifecycle context after input validation.

### Bookmark, search, workflow library

- Bookmark save/delete/query
- Full-text search
- Task evaluation save/query
- Workflow library list query
- Similar workflow search

As of recent code, `listEvaluations()` has been added to directly support
`GET /api/workflows` and the web workflow library panel.

## Role of Helper Services

### `EventRecorder`

Combines classification and persistence. Calls `classifyEvent()` and,
if necessary, creates derived `file.changed` events.

### `SessionLifecyclePolicy`

Determines when primary/background tasks should be auto-completed or moved to waiting state.

### `TraceMetadataFactory`

Organizes relation, activity, compact, verification, and question/todo metadata, and derives tags.

### `deriveTaskDisplayTitle`

When task title is too generic, infers a more meaningful display title based on user prompt
and initial events. `task-display-title-resolver.ts` has been decomposed into
`task-display-title-resolver.helpers.ts` + `task-display-title-resolver.constants.ts`
and is used in `session/task` repository.

## Read Paths and Write Paths

### Write Path

route -> schema -> `MonitorService` -> `EventRecorder`/repository -> notifier

### Read Path

route -> `MonitorService` -> repository aggregation -> read-model response

Since the read path contains significant derived calculations like workflow search and display title
computation, this class also serves as a "small read-model service" beyond just a command handler.

## Strengths

- Server use cases are centralized in one entry point, making tracking easy.
- Based on port interfaces, making testing relatively straightforward.
- Can tie together runtime session helpers and workflow library under the same task model.

## Current Risks

- Heavy concentration of responsibility leads to wide change impact.
- Read path cost and lifecycle decision-making are concentrated in one class.
- Async dedupe state (`seenAsyncEvents`) persists in memory.
- Includes bookmark/search/evaluation, resulting in low cohesion.

## Separation Candidates

- `TaskLifecycleService`
- `RuntimeSessionService`
- `EventLoggingService`
- `BookmarkService`
- `WorkflowEvaluationService`
- `TaskQueryService`

## Related Documentation

- [Monitor Server](./monitor-server.md)
- [HTTP API Reference](./http-api-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)

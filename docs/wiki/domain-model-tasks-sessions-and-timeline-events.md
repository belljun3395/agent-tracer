# Domain Model: Tasks, Sessions & Timeline Events

Agent Tracer organizes all records along three axes: task, session, and timeline event.
Understanding this model explains why the server API, MCP payload, and dashboard UI take their current forms.

## Task

A task means "one user goal". For example, topics like "update documentation", "fix type errors",
or "integrate new runtime".

Core fields:

- `id`, `title`, `slug`
- `status`: `running`, `waiting`, `completed`, `errored`
- `workspacePath`
- `taskKind`: `primary`, `background`
- `parentTaskId`, `parentSessionId`, `backgroundTaskId`
- `runtimeSource`

Characteristics:

- Background tasks can have parent lineage.
- Even if runtime session binding disconnects and reconnects, the task itself is maintained.
- `displayTitle` is a derived value of read-model nature and may differ from the original title.

## Session

A session is an individual execution period within a task. In runtimes with multiple turns like Claude plugin,
multiple sessions can exist in one task.

Core fields:

- `id`
- `taskId`
- `status`: `running`, `completed`, `errored`
- `summary`
- `startedAt`, `endedAt`

Why sessions are needed:

- Can mark boundaries between turns within the same task.
- Session close policy differs per runtime adapter.
- Can determine if background task is complete or if primary task should be waiting.

## Timeline Event

A timeline event is an actual observation unit. Recordings like user prompts, MCP calls, terminal commands,
todo state changes, verifications, and assistant responses all reside here.

Core fields:

- `kind`
- `lane`
- `title`, `body`
- `metadata`
- `classification`
- `createdAt`
- `sessionId` if needed

`classification` contains lane, tags, and match information,
while `metadata` contains additional semantics like relation, work item, MCP, skill, and question/todo phase.

## Task-Session-Event Relationship

```text
MonitoringTask
  ├─ has many MonitoringSession
  └─ has many TimelineEvent

runtime_session_bindings
  └─ maps external runtime session -> task + monitor session
```

In actual storage, bookmarks and evaluations additionally reference tasks.

## View from State Transition Perspective

### Primary Task

- `running` on start
- `waiting` if runtime turn ends but follow-up is expected
- `completed` if explicitly finished
- `errored` if failure results

### Background Task

- Usually derived within parent task.
- Can be auto-completed when last running session ends.

### Event Flow

- Task/session lifecycle events change the structure itself.
- General events enrich the timeline.
- Evaluation and workflow search are secondary features after sufficient tasks accumulate.

## Related Models That Move Together

### Runtime Session Binding

Binds external runtime's thread/session ID to monitor session.
This is why Agent Tracer can read a consistent task/session model even if Claude plugin
and manual clients have different session semantics.

### Bookmark

Saves entire task or specific event for later retrieval.

### Evaluation

Evaluates task as `good` or `skip` to add to workflow library.

## Related Files

- `packages/core/src/domain.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/services/session-lifecycle-policy.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-task-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-session-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-event-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-runtime-binding-repository.ts`

## Related Documentation

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)

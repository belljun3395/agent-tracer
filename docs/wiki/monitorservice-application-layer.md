# MonitorService: Application Layer

`MonitorService` is the main service entrypoint in `@monitor/application`.
HTTP controllers, the MCP adapter, and tests generally flow into this
class, but the implementation is now split across a few narrower helper
services instead of one large monolith.

## Core files

- `packages/application/src/monitor-service.ts`
- `packages/application/src/types.ts`
- `packages/application/src/services/task-lifecycle-service.ts`
- `packages/application/src/services/event-logging-service.ts`
- `packages/application/src/services/workflow-evaluation-service.ts`
- `packages/application/src/services/session-lifecycle-policy.ts`
- `packages/application/src/services/trace-metadata-factory.ts`
- `packages/application/src/ports/*`

## Key responsibilities

### Task and session lifecycle

`MonitorService` exposes task/session lifecycle operations such as:

- `startTask()`
- `completeTask()`
- `errorTask()`
- `endSession()`
- `ensureRuntimeSession()`
- `endRuntimeSession()`

Those flows delegate to `TaskLifecycleService`.

### Event logging

Event writes such as:

- `logUserMessage()`
- `logAssistantResponse()`
- `logTerminalCommand()`
- `logToolUsed()`
- `logExploration()`
- `logQuestion()`
- `logTodo()`
- `logThought()`
- `logAgentActivity()`
- `logVerification()`

delegate to `EventLoggingService`.

### Workflow evaluation and library reads

Evaluation save/query and workflow-library operations delegate to
`WorkflowEvaluationService`.

## Typical write path

```text
controller -> MonitorService -> helper service -> ports -> adapter
```

Examples:

- HTTP write controller -> `MonitorService.logTerminalCommand()` ->
  `EventLoggingService` -> event repository/notifier
- `runtime-session-ensure` endpoint -> `MonitorService.ensureRuntimeSession()`
  -> `TaskLifecycleService`

## Why the split matters

This package is now the actual use-case layer. Older docs referenced
`packages/server/src/application/*`, but that ownership moved into the
dedicated `@monitor/application` package.

The split also means:

- classification stays outside the server composition root
- repositories remain ports rather than direct SQLite calls
- tests can target the use-case layer without booting Nest

## Current risks

- `MonitorService` is still a wide façade, so changes here can have broad
  blast radius
- Event logging and lifecycle rules still share a lot of implicit
  coupling through task/session state
- Workflow and observability reads can still become read-heavy for large
  timelines

## Related documentation

- [Monitor Server](./monitor-server.md)
- [HTTP API Reference](./http-api-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)

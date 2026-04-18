# Core Domain & Event Model

`@monitor/core` defines a common language for the entire Agent Tracer. The purpose of this package is
to ensure that "what the server stores", "what MCP sends", and "what the web displays" all
share the same semantic system.

## Core Files

- `packages/core/src/domain/index.ts` (barrel export)
- `packages/core/src/domain/types.ts` (includes branded types: RuntimeAdapterId, SessionIdBrand, etc.)
- `packages/core/src/domain/utils.ts`
- `packages/core/src/classification/classifier.ts`
- `packages/core/src/classification/action-registry.ts`
- `packages/core/src/interop/event-semantic.ts` (hook-web semantic metadata contract)
- `packages/core/src/runtime/index.ts` (barrel export)
- `packages/core/src/runtime/capabilities.constants.ts`
- `packages/core/src/runtime/capabilities.types.ts`
- `packages/core/src/runtime/capabilities.helpers.ts`
- `packages/core/src/paths/utils.ts`

## What This Package Defines

### 1. Timeline lane

`TimelineLane` divides events into `user`, `exploration`, `planning`, `implementation`,
`questions`, `todos`, `background`, and `coordination`.
This is where the dashboard's vertical lane structure begins.

### 2. Event kind

`MonitoringEventKind` defines canonical event names such as `task.start`, `user.message`, `tool.used`,
`terminal.command`, `verification.logged`, and `assistant.response`.

### 3. Task, session, timeline event

`MonitoringTask`, `MonitoringSession`, and `TimelineEvent` are the base shapes for server storage and web responses.
Task status, background lineage, and classification payload are all bound to these types.

### 4. Event Semantic Metadata Contract

`event-semantic.ts` (added: 2026-04-10) defines an explicit contract for semantic metadata
produced by the hook layer and consumed by the web UI.

```typescript
export interface EventSemanticMetadata {
  readonly subtypeKey: EventSubtypeKey;  // "read_file", "run_test", "mcp_call", ...
  readonly subtypeGroup: EventSubtypeGroup;  // "files", "execution", "coordination"
  readonly toolFamily: EventToolFamily;  // "explore", "file", "terminal"
  readonly operation: string;            // "search", "modify", "execute", "delegate"
  readonly entityType?: string;          // "file", "directory", "command"
  readonly entityName?: string;          // specific filename, command name, etc.
}
```

By making this contract explicit at the code level, the requirement that hook and web
must be updated simultaneously when a new subtype is added is detected via type checking.

### 5. Branded Types

In `domain/types.ts`, runtime adapter IDs, session IDs, etc. are defined as nominal types
to enhance type safety between server, MCP, and web (added: 2026-04-10).

Example: `RuntimeAdapterId` (explicit branded type, not just string)

### 6. Runtime capability registry

The observability scope per runtime, session close policy, and native skill path
have `runtime-capabilities.ts` as source of truth.

## Why This Matters

A common mistake when adding new features is "only adding server routes while missing core semantic definitions".
However, since Agent Tracer has multiple runtimes, the first thing to decide when adding a feature is
"what kind and lane does this event have?", "what metadata should be considered canonical contract?"

In other words, the change order is roughly as follows:

1. Define event semantics and types in `@monitor/core`.
2. Align server schema/service/repository.
3. Align MCP tool registration or runtime adapters.
4. Enhance web display and insight calculations.

## Current Model Characteristics

### Default lane and explicit override coexist

`defaultLaneForEventKind()` provides a default lane for each event kind,
but explicit lane and action registry matching can correct this during actual recording.

### Extensive support for relational metadata

Event metadata can include connection information like `parentEventId`, `relatedEventIds`, `planId`, `workItemId`,
`relationType`, and `relationLabel`.
This enables creating timeline connectors and task handoff summaries.

### Workflow evaluation is part of core

`TaskEvaluation`, `WorkflowSummary`, and `WorkflowSearchResult` are not just UI types
but part of product-level functionality, so they are located in `core`.

## Checklist When Changing

- Verify that the web doesn't confuse the boundary between core types re-exported in `packages/web-app/src/types.ts` and web-only view-models
- Verify that MCP input schema and server request schema don't contradict the core contract
- Verify that slug generation rules are sufficient for non-ASCII titles
- Verify that path normalization absorbs differences between external runtimes and operating systems

## Related Documentation

- [Domain Model: Tasks, Sessions & Timeline Events](./domain-model-tasks-sessions-and-timeline-events.md)
- [Event Classification Engine](./event-classification-engine.md)
- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)

# Core Domain & Event Model

This wiki page keeps the historical "core" label, but the actual code is
now split across two packages:

- `@monitor/domain` owns pure value types, ids, workflow shapes, runtime
  capability registry, and shared interop contracts
- `@monitor/classification` owns event classification and semantic
  metadata derivation

Together they define the language that the server stores, the MCP layer
transports, and the web renders.

## Core files

- `packages/domain/src/index.ts`
- `packages/domain/src/monitoring/ids.ts`
- `packages/domain/src/monitoring/types.ts`
- `packages/domain/src/workflow/*`
- `packages/domain/src/runtime/capabilities.*.ts`
- `packages/domain/src/interop/event-semantic.ts`
- `packages/classification/src/classifier.ts`
- `packages/classification/src/action-registry.ts`
- `packages/classification/src/semantic-metadata.ts`

## What the shared model defines

### 1. Timeline lanes

`TimelineLane` divides events into `user`, `exploration`, `planning`,
`implementation`, `questions`, `todos`, `background`, and
`coordination`. That lane model drives the dashboard layout and the
observability summaries.

### 2. Canonical event kinds

Domain types define canonical event kinds such as `task.start`,
`user.message`, `terminal.command`, `verification.logged`,
`question.logged`, `todo.logged`, and `assistant.response`.

### 3. Tasks, sessions, and timeline events

`MonitoringTask`, `MonitoringSession`, and `TimelineEvent` are the
shared record shapes used by persistence, API responses, and the web.

### 4. Event semantic contract

`packages/domain/src/interop/event-semantic.ts` defines the shared
semantic metadata contract used by classification and consumed by the
dashboard.

This includes concepts such as:

- subtype key/group
- tool family
- operation
- entity type/name

### 5. Workflow value types

Reusable workflow snapshots, context markdown, and related ids live in
`packages/domain/src/workflow/*`. This keeps workflow evaluation from
becoming a web-only concern.

### 6. Runtime capability registry

Runtime adapter capabilities and evidence profiles live in
`packages/domain/src/runtime/*`. The domain barrel auto-registers the
built-in runtime adapters so the rest of the system does not need a
separate init step.

## Where classification begins

`@monitor/domain` defines the shapes; `@monitor/classification` turns raw
events into semantic meaning.

Key pieces:

- `classifyEvent(...)` applies action-registry rules and lane defaults
- `semantic-metadata.ts` derives subtype/tool-family/operation fields
- `action-registry.ts` is the searchable registry of command/file/tool
  patterns

This split is intentional: domain stays pure and reusable, while
classification holds the rule engine.

## Why this matters

When adding a new feature, the order is usually:

1. Define or extend the shared event/value shape in `@monitor/domain`
2. Teach `@monitor/classification` how to derive semantics for it
3. Update the relevant server/controller/adapter code
4. Update the web read path and docs

Skipping step 1 or 2 is the most common way docs and code drift.

## Current model characteristics

### Explicit runtime lineage

Runtime session ids, runtime sources, and capability evidence are all
first-class types, not loose strings.

### Shared workflow vocabulary

Workflow snapshots and context live in the shared model so evaluation,
search, and reuse can be implemented in multiple surfaces without type
duplication.

### Paths are normalized centrally

Path utility helpers in `packages/domain/src/paths/utils.ts` exist so
server, plugin, and web are not each inventing their own path rules.

## Checklist when changing the shared model

- Verify `@monitor/classification` still derives the right semantics
- Verify server request schemas and domain types still align
- Verify the web reads through `web-domain` or `domain`, not local type
  copies
- Verify the related guide/wiki page changed in the same PR

## Related documentation

- [Domain Model: Tasks, Sessions & Timeline Events](./domain-model-tasks-sessions-and-timeline-events.md)
- [Event Classification Engine](./event-classification-engine.md)
- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)

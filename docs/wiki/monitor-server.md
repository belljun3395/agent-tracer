# Monitor Server

`@monitor/server` is the core package of Agent Tracer. It ingests events
emitted by runtime adapters, structures them into tasks / sessions /
timeline events, persists them to SQLite, and exposes HTTP + WebSocket
surfaces for the dashboard and MCP layer.

## Responsibilities

- task, session, and runtime-session lifecycle
- timeline event ingestion and classification result storage
- bookmark CRUD
- workflow evaluation storage and similarity search
- read models for overview, task detail, and observability
- WebSocket broadcast of every change

## Key files

- `packages/server/src/index.ts` — process entrypoint
- `packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts` — composition root
- `packages/server/src/presentation/nestjs/app.module.ts`
- `packages/server/src/presentation/nestjs/controllers/*.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/application/services/*` — policy + metadata helpers
- `packages/server/src/application/ports/*` — repository + broadcaster interfaces
- `packages/server/src/infrastructure/sqlite/*` — SQLite repository
- `packages/server/src/presentation/ws/event-broadcaster.ts`
- `packages/server/src/presentation/schemas.ts` — Zod request schemas

## Layering

```text
bootstrap/
  create-nestjs-monitor-runtime.ts     # server composition root
  runtime.types.ts                     # public runtime types
application/
  monitor-service.ts                   # use case entrypoint
  services/                            # policy + metadata helpers
  ports/                               # repository + broadcaster interfaces
presentation/
  nestjs/controllers/                  # HTTP surface (Nest controllers)
  nestjs/app.module.ts
  schemas.ts                           # Zod DTOs
  ws/event-broadcaster.ts              # WebSocket notifications
infrastructure/
  sqlite/                              # SQLite-backed repository
```

### Application

`MonitorService` is the single entrypoint for use cases. It handles task
start / complete, runtime session ensure / end, event logging, bookmark
CRUD, evaluation, and search. Supporting policy and metadata logic lives
in `application/services/*` (e.g. `session-lifecycle-policy.ts`,
`trace-metadata-factory.ts`).

### Presentation

NestJS controllers handle the HTTP surface. `presentation/schemas.ts`
validates request bodies with Zod before delegating to `MonitorService`.
`EventBroadcaster` in `presentation/ws/` handles real-time notifications.

Controllers currently registered:

- `admin.controller.ts` — overview / read model
- `lifecycle.controller.ts` — task / session lifecycle
- `event.controller.ts` — generic event logging
- `bookmark.controller.ts` — bookmark CRUD
- `search.controller.ts` — search read model
- `evaluation.controller.ts` — workflow library evaluation + search

### Infrastructure

SQLite is the only storage backend that currently runs. Repositories
live in `infrastructure/sqlite/*.repository.ts` and are composed in
`infrastructure/sqlite/index.ts`. Because the application layer only
depends on the port interfaces, swapping storage is a matter of
providing a new adapter.

## Bootstrap flow

1. `EventBroadcaster` is constructed.
2. `NestFactory.create(AppModule.forRoot(...))` wires SQLite ports,
   `MonitorServiceProvider`, and the controllers.
3. HTTP server and `WebSocketServer` are attached to the same Nest
   instance.
4. `/ws` upgrade requests are accepted; overview + task list snapshots
   are sent to new WebSocket clients immediately.

## Points worth knowing

- The default runtime is NestJS — there is no alternative composition
  root in the current code.
- Canonical `runtimeSource` is `claude-plugin` (with `claude-hook`
  kept as a legacy alias).
- The workflow library read path and the observability read model are
  first-class API surfaces, not ad-hoc debugging endpoints.
- Runtime session and explicit session-end coexist so auto-plugins and
  manual clients can both bind to the same task.

## Maintenance notes

### `MonitorService` responsibility spread

Lifecycle, runtime-session binding, generic event logging, bookmark
CRUD, search, and evaluation all live under one service. It works today
but the next structural improvement is to split it into use-case-level
services (lifecycle / event logging / bookmark / evaluation).

### Schema / DTO drift risk

`presentation/schemas.ts` (Zod) and `application/types.ts` (TS
interfaces) must stay in sync. Every new field is two edits, so
consider descriptor-level sharing if this becomes a bottleneck.

### Read-path cost

The task list read path rebuilds display titles from event history,
which scales linearly with event count per task. At higher volume a
cached write-model / read-model split will become worthwhile.

### Async dedupe map

The monitor service uses an in-memory dedupe map for async events.
There is no cleanup policy yet; for long-running servers a TTL or LRU
eviction should be added before the map grows unbounded.

## Reading order

1. `src/index.ts`
2. `src/bootstrap/create-nestjs-monitor-runtime.ts`
3. `src/presentation/nestjs/controllers/*.ts`
4. `src/application/monitor-service.ts`
5. `src/infrastructure/sqlite/index.ts`

## Related

- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [HTTP API Reference](./http-api-reference.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)
- [Quality and Testing](./quality-and-testing.md)

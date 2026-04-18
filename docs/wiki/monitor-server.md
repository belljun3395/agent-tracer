# Monitor Server

`@monitor/server` is the runtime composition package for Agent Tracer.
It is not the whole backend by itself: the server package bootstraps
NestJS, wires the HTTP and persistence adapters, and exposes the monitor
runtime. Most backend logic lives one layer inward in
`@monitor/application`.

## Responsibilities

- boot the NestJS HTTP runtime
- compose read/write controllers from the HTTP adapter packages
- compose SQLite-backed ports and the optional embedding service
- expose the monitor HTTP API and `/ws` WebSocket endpoint
- bridge notifier events to connected WebSocket clients

## Key files

- `packages/server/src/index.ts`
- `packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts`
- `packages/server/src/bootstrap/runtime.types.ts`
- `packages/server/src/presentation/app.module.ts`
- `packages/server/src/presentation/database/database.provider.ts`
- `packages/application/src/monitor-service.ts`
- `packages/adapter-http-ingest/src/*.ts`
- `packages/adapter-http-query/src/*.ts`
- `packages/adapter-sqlite/src/index.ts`
- `packages/adapter-ws/src/event-broadcaster.ts`

## Layering

```text
@monitor/server
  bootstrap/
    create-nestjs-monitor-runtime.ts
    runtime.types.ts
  presentation/
    app.module.ts
    database/database.provider.ts
    filters/zod-exception.filter.ts

@monitor/application
  monitor-service.ts
  services/*
  ports/*

@monitor/adapter-http-ingest
  Nest write controllers

@monitor/adapter-http-query
  Nest read controllers

@monitor/adapter-sqlite
  repository implementations
```

## What lives where

### Server package

The server package is intentionally small. It should contain:

- bootstrap logic
- Nest module wiring
- database/notifier composition
- HTTP/WebSocket runtime glue

It should not grow a second copy of the application layer.

### Application layer

`MonitorService` and the supporting services in `@monitor/application`
own lifecycle changes, event logging, observability analysis, workflow
evaluation, and the port-based boundary to persistence and broadcast.

### HTTP adapters

The controller classes no longer live inside `packages/server/src`.
Write routes come from `@monitor/adapter-http-ingest`, and read routes
come from `@monitor/adapter-http-query`.

### Infrastructure adapters

SQLite persistence comes from `@monitor/adapter-sqlite`. WebSocket fanout
comes from `@monitor/adapter-ws`. The optional embedding service comes
from `@monitor/adapter-embedding`.

## Bootstrap flow

1. `packages/server/src/index.ts` loads config and resolves the database
   path, listen host, and public base URL.
2. `createNestMonitorRuntime()` creates an `EventBroadcaster`.
3. `AppModule.forRoot(...)` registers:
   - `DatabaseProvider(...)`
   - `MonitorService`
   - read/write controllers from the adapter packages
4. `DatabaseProvider(...)` registers default runtime adapters, creates
   the embedding service if available, and returns SQLite-backed ports.
5. The server attaches a `WebSocketServer` to `/ws` and sends an initial
   snapshot (`overview + task list`) to each client.

## Points worth knowing

### Runtime session lifecycle is first-class

The backend distinguishes task lifecycle from runtime-session lifecycle.
That is what allows a Claude turn boundary to close a runtime session
without losing task continuity.

### Classification happens on the server

The Claude plugin posts mostly raw payloads. Lane/subtype/tool-family
derivation happens after ingestion in `@monitor/classification`.

### Search and workflow evaluation are backend features

The workflow library and similarity search are not web-only conveniences.
They are first-class backend use cases exposed through the HTTP API.

## Maintenance notes

### Server docs drift easily when adapter ownership changes

Because controllers and repositories now live in separate packages,
server docs need to name those adapter packages explicitly instead of
pretending everything is under `packages/server/src`.

### `MonitorService` has been decomposed, but not fully

`MonitorService` now delegates to `TaskLifecycleService`,
`EventLoggingService`, and `WorkflowEvaluationService`. That is better
than the previous monolith, but the class is still the central service
entrypoint for many flows.

### WebSocket payloads are still invalidation-oriented

The web currently uses the socket mostly as a query invalidation hint.
If event volume grows, incremental client updates may be worth adding.

## Reading order

1. `packages/server/src/index.ts`
2. `packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts`
3. `packages/server/src/presentation/app.module.ts`
4. `packages/application/src/monitor-service.ts`
5. `packages/server/src/presentation/database/database.provider.ts`

## Related

- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [HTTP API Reference](./http-api-reference.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)
- [Quality and Testing](./quality-and-testing.md)

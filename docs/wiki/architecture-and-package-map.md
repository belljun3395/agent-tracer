# Architecture & Package Map

Agent Tracer is an npm-workspaces TypeScript monorepo with a clear
inner-to-outer dependency direction:

```text
domain -> classification -> application -> adapter-* -> server
domain -> web-domain -> web-io -> web-state -> web-app
hook-plugin -> HTTP only (no application imports)
adapter-mcp -> HTTP only (no inner-ring logic)
```

The important correction to older docs is that `@monitor/core` no longer
exists. The shared model now lives in three packages: `domain`,
`classification`, and `application`.

## Package map

| Package | Role | Key files |
| --- | --- | --- |
| `@monitor/domain` | Pure ids, types, workflow shapes, runtime capability registry, shared interop contracts | `packages/domain/src/index.ts`, `packages/domain/src/monitoring/*`, `packages/domain/src/runtime/*`, `packages/domain/src/interop/event-semantic.ts` |
| `@monitor/classification` | Event classifier and semantic metadata derivation | `packages/classification/src/classifier.ts`, `packages/classification/src/action-registry.ts`, `packages/classification/src/semantic-metadata.ts` |
| `@monitor/application` | Use cases, observability analyzers, workflow evaluation logic, and ports | `packages/application/src/monitor-service.ts`, `packages/application/src/services/*`, `packages/application/src/ports/*` |
| `@monitor/adapter-http-ingest` | Write-side Nest controllers | `packages/adapter-http-ingest/src/*.ts` |
| `@monitor/adapter-http-query` | Read-side Nest controllers | `packages/adapter-http-query/src/*.ts` |
| `@monitor/adapter-sqlite` | SQLite-backed port implementations | `packages/adapter-sqlite/src/index.ts`, `packages/adapter-sqlite/src/sqlite-*.ts` |
| `@monitor/adapter-ws` | WebSocket broadcaster | `packages/adapter-ws/src/event-broadcaster.ts` |
| `@monitor/adapter-mcp` | MCP stdio server that forwards to the monitor HTTP API | `packages/adapter-mcp/src/index.ts`, `packages/adapter-mcp/src/client.ts`, `packages/adapter-mcp/src/tools/*` |
| `@monitor/adapter-embedding` | Local embedding service used for workflow similarity | `packages/adapter-embedding/src/index.ts` |
| `@monitor/claude-plugin` | Claude Code hook adapter surfaced as `.claude/plugin` | `packages/hook-plugin/hooks/*`, `packages/hook-plugin/bin/run-hook.sh` |
| `@monitor/server` | NestJS composition root and runtime bootstrap | `packages/server/src/index.ts`, `packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts`, `packages/server/src/presentation/app.module.ts` |
| `@monitor/web-domain` | Web-facing read-model types and pure selectors | `packages/web-domain/src/*` |
| `@monitor/web-io` | Browser-boundary adapters for HTTP, WebSocket, and safe storage | `packages/web-io/src/api.ts`, `packages/web-io/src/realtime.ts`, `packages/web-io/src/websocket.ts`, `packages/web-io/src/storage.ts` |
| `@monitor/web-state` | React Query and Zustand-based UI state | `packages/web-state/src/query/*`, `packages/web-state/src/server/*`, `packages/web-state/src/realtime/*`, `packages/web-state/src/ui/*` |
| `@monitor/web-app` | React 19 dashboard | `packages/web-app/src/App.tsx`, `packages/web-app/src/components/*`, `packages/web-app/src/features/*` |

## Dependency direction

### Inner ring

- `@monitor/domain` is pure and imports no other `@monitor/*` packages.
- `@monitor/classification` depends only on `@monitor/domain`.
- `@monitor/application` depends on `@monitor/domain` and
  `@monitor/classification`.

### Adapters and runtime edges

- HTTP controllers, SQLite persistence, WebSocket broadcast, embeddings,
  and the MCP adapter are all adapters around `@monitor/application`.
- `@monitor/server` is intentionally thin: it composes adapters and the
  Nest runtime, but business logic stays in `@monitor/application`.
- `@monitor/claude-plugin` does not import the application layer. It
  posts raw payloads over HTTP and lets the server classify them.

### Web stack

- `@monitor/web-domain` depends only on `@monitor/domain`.
- `@monitor/web-io` wraps HTTP, WebSocket, and safe storage concerns.
- `@monitor/web-state` owns query invalidation, socket wiring, and UI
  stores.
- `@monitor/web-app` is the React composition layer and does not import
  `@monitor/application`, server internals, or adapters directly.

## Composition root

### Server runtime composition

`packages/server/src/index.ts` is the runtime entrypoint. It resolves the
config, then calls `createNestMonitorRuntime()`.

`packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts` wires:

1. `AppModule.forRoot(...)`
2. `DatabaseProvider(...)`, which creates the SQLite-backed ports and
   optional embedding service
3. Read/write HTTP controllers from the adapter packages
4. `MonitorService` from `@monitor/application`
5. A `WebSocketServer` bridged through `EventBroadcaster`

### MCP entrypoint

`packages/adapter-mcp/src/index.ts` registers the MCP tool set and uses
`MonitorClient` to forward calls to the server's HTTP API.

### Web entrypoint

`packages/web-app/src/main.tsx` mounts the React app.
`packages/web-app/src/App.tsx` composes routing, dashboard layout,
selection plumbing, and workspace/knowledge views. Data fetching and UI
stores are provided by `@monitor/web-state`.

## Responsibility boundaries

### Domain defines value types and registries

Task/session/event types, workflow shapes, runtime capability registry,
and shared interop contracts all start in `@monitor/domain`.

### Classification derives semantics

Lane/subtype/tool-family derivation happens in `@monitor/classification`.
The Claude plugin no longer does client-side semantic classification.

### Application owns use cases

Lifecycle management, event logging, workflow evaluation, search, and
observability analysis live in `@monitor/application`.

### Adapters speak the outside world's protocol

HTTP controllers, SQLite, WebSocket, MCP, and embeddings are all
adapter surfaces around the application layer.

### Web packages stay isolated from the server

The dashboard consumes the HTTP/WebSocket contract only. It should never
reach into server/application internals to share logic.

## Extension points

- Add a new runtime event: update `@monitor/domain`,
  `@monitor/classification`, the relevant adapter/controller surface, and
  the guide docs together
- Add a new persistence backend: implement the application ports in a new
  adapter package
- Add a new dashboard read model: evolve `web-domain`, `web-io`,
  `web-state`, and the server read endpoint together

## Related documentation

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Monitor Server](./monitor-server.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [Web Dashboard](./web-dashboard.md)
- [Quality and Testing](./quality-and-testing.md)

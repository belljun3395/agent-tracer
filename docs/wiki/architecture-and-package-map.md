# Architecture & Package Map

Agent Tracer is a TypeScript monorepo based on npm workspaces, and the overall structure is easiest to read as
"shared contract (core) + application server (server) + agent adapters (mcp) + presentation (web)".
It has typical ports-and-adapters characteristics, but its actual operation is centered on the composition root and shared domain contract.

## Package Map

| Package | Role | Key Files |
| --- | --- | --- |
| `@monitor/core` | Domain types, event classifier, runtime capability registry | `src/domain.ts` (barrel), `src/domain/*`, `src/classifier.ts`, `src/runtime-capabilities.ts` (barrel) |
| `@monitor/server` | NestJS server runtime, application service, SQLite repository, WebSocket broadcaster | `src/index.ts`, `src/bootstrap/create-nestjs-monitor-runtime.ts`, `src/application/monitor-service.ts` |
| `@monitor/adapter-mcp` | Expose server API as MCP tool set | `src/index.ts`, `src/client.ts` |
| `@monitor/web` | Dashboard UI, overview/task detail fetch, realtime refresh | `src/App.tsx`, `src/store/useMonitorStore.tsx`, `src/components/Timeline.tsx` |

## Dependency Direction

Code dependencies generally follow the direction below:

```text
@monitor/core
  ├─> @monitor/server
  ├─> @monitor/adapter-mcp
  └─> @monitor/web

@monitor/server <----HTTP/WebSocket----> @monitor/web
@monitor/adapter-mcp ----HTTP-------------------> @monitor/server
```

The important point is that `server` does not import the `web` package.
The two packages are connected only via runtime communication, and `core` provides the shared type semantics.

## Composition Root

### Server Runtime Composition

The default process entry point is `packages/server/src/index.ts`, which calls
`createNestMonitorRuntime()` to launch the NestJS runtime.

`packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts` is
the current default composition root that bundles NestJS `AppModule`, WebSocket upgrade, and initial snapshot transmission.

### MCP Entry Point

`packages/adapter-mcp/src/index.ts` registers 24 monitoring tools and
maps each tool to a monitor server HTTP endpoint.

### Web Entry Point

`packages/web/src/main.tsx` and `packages/web/src/App.tsx` are the presentation composition root.
State management is handled by `useMonitorStore`, and realtime synchronization by `useWebSocket` and `lib/realtime.ts`.

## Responsibility Separation Between Packages

### Core Defines Semantics

New event types, lane semantics, runtime adapter capabilities—any semantics the entire system must share
must first be finalized in `@monitor/core`.

### Server Owns Lifecycle and Persistence

Task/session/event storage, runtime session binding, evaluation storage and search,
WebSocket notification are all responsibilities of `@monitor/server`.

### MCP Opens Manual/Semi-Automated Agent Paths

In environments without automatic plugins, the MCP layer effectively acts as an observability adapter.

### Web Owns Read Model and Exploration Experience

Web consumes the server's canonical state to create timeline, inspector, and workflow library experiences.
Some domain calculations are concentrated in `lib/insights.ts` and `lib/timeline.ts`.

## Extension Points

- Adding new runtime adapter: Update `@monitor/core` capability registry, server endpoint strategy, and guide docs together
- Adding new monitoring event: Verify impact on core type, server schema/route/service, MCP registration, and web rendering
- Adding new read model: Design server API and web fetch/store paths together

## Strengths and Cautions of Current Structure

Strengths:

- Package boundaries are well-reflected in file structure and actual dependency directions.
- Execution path is clear through `index.ts` → `createNestMonitorRuntime.ts` → controller/module structure.
- `core` bundles shared contract, so multiple runtimes don't disrupt basic semantics.

Cautions:

- Web has converged key types back to `core`, but search hits and read-model interfaces still have web-only shapes.
- Large modules like `MonitorService`, `App.tsx`, `Timeline.tsx`, `insights.ts` carry heavy responsibilities.
- Areas where docs and code easily drift: runtime integration and bootstrap paths. Since this repository is Claude-plugin-focused, it's safer to describe manual runtimes at the level of generic HTTP/MCP contracts.

## Related Documentation

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Monitor Server](./monitor-server.md)
- [MCP Server](./mcp-server.md)
- [Web Dashboard](./web-dashboard.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)

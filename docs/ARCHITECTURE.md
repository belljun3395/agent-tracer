# Architecture — Package Dependency Rules

> Authoritative source: `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md`
> Current migration phase: **Phase 9d (hexagonal boundary migration complete — `packages/core/` deleted; all consumers import leaf packages directly)**

## Dependency graph (target state)

```
domain ← classification ← application ← adapter-* ← server
                                     ↑
                      (web-* depend only on domain via HTTP)
```

## Allow-list

| Package | May import |
|---|---|
| `@monitor/domain` | — |
| `@monitor/classification` | `domain` |
| `@monitor/application` | `domain`, `classification` |
| `@monitor/adapter-*` | `domain`, `application` |
| `@monitor/runtime-claude` | `domain` (wire schemas only) |
| `@monitor/server` | all adapters + `application` + `domain` |
| `@monitor/web-domain` | `domain` |
| `@monitor/web-io` | `web-domain`, `domain` |
| `@monitor/web-state` | `web-io`, `web-domain`, `domain` |
| `@monitor/web-app` | `web-state`, `web-domain`, `domain` |

## Hard prohibitions

- Cross-adapter imports (`adapter-X → adapter-Y`)
- Reverse direction (`application → adapter-*`)
- `classification` importing `application`
- Subpath imports (`@monitor/foo/src/bar`)
- `domain` importing any other `@monitor/*` package
- `runtime-claude` importing `application` or `classification`
- `web-*` importing `server`, adapters, or `application`

## Enforcement

1. `tsc --build` — TypeScript project references
2. `npm run lint:deps` — dependency-cruiser validation
3. `exports` field in every `package.json` — blocks subpath imports at resolver

During the Phase 0–9 migration these rules roll out gradually as **warnings first**, then upgrade to errors once each phase passes. See `.dependency-cruiser.cjs` for which rules are `error` vs `warn` today.

## Current phase notes

- `@monitor/domain`, `@monitor/classification`, `@monitor/application`, and the driven/driving adapters (`adapter-sqlite`, `adapter-embedding`, `adapter-http-ingest`, `adapter-http-query`, `adapter-ws`, `adapter-mcp`) are now the canonical leaf packages. The transitional `@monitor/core` shim was removed in Phase 9d — its auto-registration of default runtime adapters now lives in the `@monitor/domain` barrel.
- `IEmbeddingService` is now an `@monitor/application` port (carries a `modelId` identifier so persisted rows declare which model produced their vectors). `adapter-sqlite` consumes it; `adapter-embedding` provides the local `LocalEmbeddingService` implementation.
- Enforced as errors: `domain-is-pure`, `classification-depends-on-domain-only`, `application-inner-ring`, `no-cross-adapter`, `runtime-claude-wire-only` (Phase 6), `adapter-mcp-inner-ring` (Phase 7), `web-isolated` (Phase 8c), `application-no-adapter` + `no-subpath-imports` (Phase 9a).
- All nine `.dependency-cruiser.cjs` rules are now `error`-level. Phase 9 completed the `@monitor/core` migration (9b web-*, 9c server + adapters, 9d deletion). Remaining Phase 9 debt: adopt TypeScript project references + `exports` fields for every package (tracked as Phase 9e / cleanup).
- `@monitor/runtime-claude` v0.2.0 removes all client-side semantic classification and FS state (session cache, metadata, history). Every hook posts raw payloads; the server classifies at ingestion via `@monitor/classification`. The only plugin-local state is the per-session transcript cursor at `.claude/.transcript-cursors/<sid>.json`.
- `@monitor/adapter-mcp` (renamed from `@monitor/mcp` in Phase 7) is a driving adapter: `createMonitorMcpServer(client)` registers 24 `monitor_*` tools that forward stdio-received MCP calls to the monitor server's HTTP surface via `MonitorClient`. It holds no business logic and currently imports no `@monitor/*` packages — the inner-ring rule is a safety net against future drift.
- `@monitor/web-app` (renamed from `@monitor/web` in Phase 8a) is the React 19 dashboard — purely a consumer of `web-state` / `web-io` / `web-domain`. It never imports `application`, adapters, or `server`; the `web-isolated` rule is now `error`-level (Phase 8c). Ephemeral UI state (`selection`, `edit`) lives in `web-state` as factory stores mounted by `<UiStoreProvider>` (Phase 8b), so each mount owns its own zustand bundle — no module-scope singletons.
- All code imports from `@monitor/domain` / `@monitor/classification` / `@monitor/application` / `@monitor/adapter-*` directly. `@monitor/core` no longer exists.
- Pre-existing tech debt: several packages suffer "leaky dist" — `tsc`'s `rootDir` inflates when `paths` mapping leads out of `src/`, so `dist/<pkg>/src/*.js` layout diverges from each `package.json`'s `main: "./dist/index.js"`. This blocks production `vite build` but has no effect on `lint`/`lint:deps`/`test`, which is what CI gates on. Phase 9 will resolve via TypeScript project references and/or per-package bundling.

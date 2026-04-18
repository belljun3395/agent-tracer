# Package Boundary Redesign — Hexagonal Migration

**Status:** Approved design, awaiting implementation plan
**Date:** 2026-04-17
**Goal:** Restructure the monorepo into a hexagonal (ports & adapters) architecture with
enforceable dependency rules, so technical debt accumulated during Claude Code-assisted
development is structurally prevented rather than periodically cleaned up.

This is **Spec 1 of 2** in a decomposed effort. Spec 2 (intra-package layering) follows
after this one ships.

---

## 1. Goals & Constraints

### Goals
1. **Unambiguous placement rule** — for any new code, one question answers where it goes:
   *"Is it pure logic or I/O? Is it domain or use case?"*
2. **Dependency direction is machine-checked**, not document-checked. A wrong-direction
   import MUST fail `tsc --build`, `dependency-cruiser`, or both.
3. **Public API of every package is an explicit barrel**. Subpath imports
   (`@monitor/foo/src/bar`) are blocked at the `exports` field level.
4. **Eliminate duplicated responsibility** (notably: classification logic that currently
   lives in both `.claude/plugin/` and `packages/core/`).

### Constraints
- **Blast radius: A (unlimited).** Breaking changes in `@monitor/*` public API are
  acceptable. Users expected to follow major-version bumps.
- **Observation principle preserved:** the Claude Code hook plugin never writes to
  stdout, never exits with code 2, never modifies tool input. All hook behavior remains
  purely observational regardless of restructuring.
- **CI must remain green between phases.** No "big bang" PR.

---

## 2. Target Package Graph

### 2.1 Packages (15 total)

#### Inner rings (pure)

| Package | Responsibility | Runtime deps |
|---|---|---|
| `@monitor/domain` | Types, branded IDs, invariants, wire-format zod schemas | `zod` only |
| `@monitor/classification` | Pure classifier, action registry, semantic metadata builders | `@monitor/domain` |
| `@monitor/application` | Use cases + port interfaces (Repository/Bus/Clock/IdGen/Embedding) | `@monitor/domain`, `@monitor/classification` |

> Ports are defined inside `application` rather than a separate `ports` package,
> because ports belong to the application that needs them.

#### Driven adapters (outbound — called by application)

| Package | Implements |
|---|---|
| `@monitor/adapter-sqlite` | `EventRepository`, `SessionRepository`, `RuntimeSessionRepository`, `TaskRepository` (Drizzle + better-sqlite3) |
| `@monitor/adapter-embedding` | `EmbeddingProvider` (HuggingFace transformers) |

#### Driving adapters (inbound — call application)

| Package | Role |
|---|---|
| `@monitor/adapter-http-ingest` | `/api/*`, `/ingest/v1/events` — write path |
| `@monitor/adapter-http-query` | timeline/search/observability — read path |
| `@monitor/adapter-ws` | WebSocket realtime broadcast |
| `@monitor/adapter-mcp` | MCP stdio server |

#### External producer

| Package | Note |
|---|---|
| `@monitor/runtime-claude` | Claude Code hook handlers. Runs in Claude's process. Depends only on `@monitor/domain` (wire schemas). Must NOT import `application` or other adapters. |

#### Composition root

| Package | Note |
|---|---|
| `@monitor/server` | NestJS bootstrap. **Only** package permitted to import multiple adapters. Contains no business logic. |

#### UI ring (isolated from server internals)

| Package | Depends on |
|---|---|
| `@monitor/web-domain` | `@monitor/domain` |
| `@monitor/web-io` | `@monitor/web-domain`, `@monitor/domain` |
| `@monitor/web-state` | `@monitor/web-io`, `@monitor/web-domain`, `@monitor/domain` |
| `@monitor/web-app` | `@monitor/web-state`, `@monitor/web-domain`, `@monitor/domain` |

Web packages MUST NOT import `server`, `application`, or any `adapter-*`. Their only
server contact is via HTTP/WS (wire schemas in `@monitor/domain`).

### 2.2 Dependency graph

```
                     ┌──────────────┐
                     │   domain     │◄────── all arrows terminate here
                     └──────▲───────┘
                            │
               ┌────────────┼───────────────┐
               │            │               │
      ┌────────┴────┐ ┌─────┴────────┐      │
      │classification│ │ application │      │
      └────────▲────┘ └─────▲────────┘      │
               │            │               │
               └────┬───────┘               │
                    │                       │
    ┌───────────────┼──────────┬────────────┼────────────┐
    │               │          │            │            │
adapter-sqlite  adapter-http-* adapter-ws adapter-mcp adapter-embedding
    │               │          │            │            │
    └───────────────┴────┬─────┴────────────┴────────────┘
                         │
                         ▼
                    ┌─────────┐
                    │ server  │ ← unique composition root
                    └─────────┘

runtime-claude ──────► domain (wire schemas only) ──HTTP──► adapter-http-ingest

web-app → web-state → web-io → web-domain → domain
                                                 ▲
                                                 │ ──HTTP/WS── adapter-http-*/adapter-ws
```

### 2.3 Current → target file mapping

| Current location | Target package |
|---|---|
| `packages/core/src/domain/*` | `@monitor/domain` |
| `packages/core/src/shared/*` (ids, pure utils) | `@monitor/domain` or absorbed by adapter |
| `packages/core/src/interop/*` | `@monitor/domain` (wire schemas) |
| `packages/core/src/monitoring/*` | split: types → `domain`, logic → `classification` |
| `packages/core/src/classification/*` | `@monitor/classification` |
| `packages/core/src/runtime/*` | split: types → `domain`, logic → `application` |
| `packages/core/src/workflow/*` | `@monitor/application` |
| `packages/core/src/paths/*` | absorbed by relevant adapter |
| `packages/server/src/application/*` | `@monitor/application` |
| `packages/server/src/infrastructure/sqlite/*` | `@monitor/adapter-sqlite` |
| `packages/server/src/infrastructure/embedding/*` | `@monitor/adapter-embedding` |
| `packages/server/src/presentation/http/*` | split into `adapter-http-ingest` + `adapter-http-query` |
| `packages/server/src/presentation/ws/*` | `@monitor/adapter-ws` |
| `packages/server/src/bootstrap/*` + `main.ts` + `app.module.ts` | `@monitor/server` |
| `packages/mcp/*` | `@monitor/adapter-mcp` |
| `.claude/plugin/hooks/*` | `@monitor/runtime-claude` (formally added to workspaces) |
| `packages/web*` | renamed to `web-app`, else unchanged in rename-only sense |

---

## 3. Dependency Rules & Enforcement

### 3.1 Allow-list per package

| Package | May import |
|---|---|
| `domain` | (none; `zod` runtime only) |
| `classification` | `domain` |
| `application` | `domain`, `classification` |
| `adapter-sqlite` | `domain`, `application` |
| `adapter-embedding` | `domain`, `application` |
| `adapter-http-ingest` | `domain`, `application` |
| `adapter-http-query` | `domain`, `application` |
| `adapter-ws` | `domain`, `application` |
| `adapter-mcp` | `domain`, `application` |
| `runtime-claude` | `domain` (wire schemas only) |
| `server` | all adapters + `application` + `domain` |
| `web-domain` | `domain` |
| `web-io` | `domain`, `web-domain` |
| `web-state` | `domain`, `web-domain`, `web-io` |
| `web-app` | `domain`, `web-domain`, `web-io`, `web-state` |

### 3.2 Forbidden (the common Claude-induced mistakes)

- `adapter-X → adapter-Y` (cross-adapter)
- `application → adapter-*` (reverse direction)
- `classification → application`
- `domain → anything @monitor/*`
- `runtime-claude → application | adapter-*`
- `web-* → server | adapter-* | application`
- Subpath imports (`@monitor/foo/src/bar`)

### 3.3 Three-layer enforcement

**Layer 1 — TypeScript project references.** Each package's `tsconfig.json` declares
`references` only to allowed dependencies. `tsc --build` fails on undeclared references.

**Layer 2 — `dependency-cruiser` rules** (config in `.dependency-cruiser.cjs`):

```js
forbidden: [
  { name: "no-cross-adapter",
    from: { path: "^packages/adapter-" },
    to:   { path: "^packages/adapter-" } },
  { name: "application-no-adapter",
    from: { path: "^packages/application" },
    to:   { path: "^packages/adapter-" } },
  { name: "domain-is-pure",
    from: { path: "^packages/domain" },
    to:   { path: "^packages/(?!domain)" } },
  { name: "runtime-claude-wire-only",
    from: { path: "^packages/runtime-claude" },
    to:   { path: "^packages/(?!domain)" } },
  { name: "web-isolated",
    from: { path: "^packages/web-" },
    to:   { path: "^packages/(application|adapter-|server)" } },
  { name: "no-subpath-imports",
    from: {},
    to:   { path: "^packages/[^/]+/src/" } }
]
```

**Layer 3 — `exports` field lock** on every package.json:

```json
"exports": {
  ".": { "development": "./src/index.ts", "default": "./dist/index.js" }
}
```

This blocks subpath access at the Node/Vite resolver level.

### 3.4 Public API conventions

- **Explicit re-exports only** in `src/index.ts`. No `export *` (named exports force
  intentionality).
- **Types via `export type { ... }`.**
- **Factories, not singletons.** Adapters export `createXxx(deps)` functions; they
  never instantiate DB connections, HTTP servers, or classes at module load time.
  Composition root (`@monitor/server`) is the only place instances are built.

---

## 4. Per-Package Contracts

### 4.1 `@monitor/domain`
**One-liner:** Shared language of the system.

Owns: `TaskId`, `SessionId`, `RuntimeSessionId`, `EventId`, `EventKind`, `TimelineLane`,
`Task`, `Session`, `RuntimeSession`, `MonitorEvent` (+ subtypes), `ActionRegistryEntry`,
`SemanticMetadata`, `CapabilityFlag`, `Workflow`, `Evidence`.

Public API: all domain types; wire zod schemas (`eventIngestSchema`,
`runtimeSessionEnsureSchema`, …); literal constants (`EVENT_KIND`, `TIMELINE_LANE`,
`RUNTIME_SOURCE`); branded id constructors (`createTaskId`, `createEventId`).

Forbidden: Node fs/path/process, framework symbols, `Date.now()`.

### 4.2 `@monitor/classification`
**One-liner:** Pure classification functions.

Public API: `inferCommandSemantic`, `inferExploreSemantic`, `inferFileToolSemantic`,
`resolveActionRegistryEntry`, `buildSemanticMetadata`, `ACTION_REGISTRY` (read-only).

Forbidden: any I/O, any nondeterminism. Must be reproducible from input alone.

### 4.3 `@monitor/application`
**One-liner:** Use cases + port interfaces.

Ports: `EventRepository`, `SessionRepository`, `RuntimeSessionRepository`,
`TaskRepository`, `EventBus`, `EmbeddingProvider`, `Clock`, `IdGenerator`,
`TranscriptReader`.

Use cases: `IngestEventUseCase`, `EnsureRuntimeSessionUseCase`, `EndRuntimeSessionUseCase`,
`QueryTimelineUseCase`, `SearchEventsUseCase`, `BuildObservabilityOverviewUseCase`,
`BuildObservabilityTaskUseCase`, `ResolveWorkflowContextUseCase`,
`IngestTranscriptEntriesUseCase`.

All use cases are factories: `createXxxUseCase(deps) => async (input) => output`.

Forbidden: any adapter import, any string literal naming a specific technology
(`sqlite`, `express`, `ws`, `huggingface`).

### 4.4 Adapters (summary)

All adapter packages follow the same pattern:
- Public API is a factory function (`createXxx`) returning the port implementation or
  a driving-side attachable (Express router, MCP server, WS attach fn).
- Internal layout: `src/index.ts` (barrel), `src/<impl>.ts`, `src/<types>.ts`.
- No business logic; adapters are translation layers between transport and use cases.

### 4.5 `@monitor/runtime-claude`
**One-liner:** Claude Code hook runners that POST raw payloads to
`adapter-http-ingest`.

Special rules:
- No runtime exports (entry points are `hooks/*.ts` and `bin/run-hook.sh`).
- Depends only on `@monitor/domain` for wire schemas.
- Performs no classification. Sends raw hook payload; server classifies.
- Local state minimized to ingest cache and transcript cursor only; session metadata
  and session-history move to server DB.
- Filters self-referencing MCP calls (`mcp__agent-tracer__*`, `mcp__monitor__*`) before
  wire emission.

### 4.6 `@monitor/server`
**One-liner:** Composition root. NestJS app that wires adapters into application.

Public API: `bootstrap(config)`, `createAppModule(config)` (for tests).

Rule: contains zero business logic. Adding a feature here is a design smell.

### 4.7 Web packages

- `web-domain`: FE view models, i18n keys, selector utilities.
- `web-io`: `createMonitorHttpClient()`, `createRealtimeClient()` — factories only.
- `web-state`: `useTimeline()`, `useInspector()`, `createUiStore()` — react-query hooks,
  factory-created Zustand stores.
- `web-app`: React 19 UI, routes.

---

## 5. Data Flow (Post-Migration)

### 5.1 Ingest

```
Claude Code hook
  → runtime-claude (validate + POST raw)
  → adapter-http-ingest (re-validate zod)
  → application.IngestEventUseCase
     ├─ classification.buildSemanticMetadata(raw)
     ├─ EventRepository.save(event)
     └─ EventBus.publish(event)
  → adapter-sqlite persist + adapter-ws broadcast
```

Classification moves **exclusively to the server**. Plugin is a data collector only.

### 5.2 Session state ownership

- **Truth lives in server DB.** Plugin retains only `{taskId, sessionId}` cache and
  per-session transcript cursor.
- `.session-cache/*-metadata.json` and `~/.claude/.session-history.json` are
  **deleted**. Their contents move to server-side `runtime_sessions` table and a new
  `/api/runtime-session-history` query endpoint.

### 5.3 Transcript tail

- Plugin: read cursor → parse JSONL new entries → POST array of raw entries to
  `/ingest/v1/transcript-entries`.
- Server: `IngestTranscriptEntriesUseCase` → `classification.mapTranscriptEntryToEvent`
  → dedupe by deterministic messageId → persist + publish.

### 5.4 Query

```
web-app → web-state (react-query) → web-io (http client)
  → adapter-http-query
  → application.BuildObservabilityOverviewUseCase (or other read UC)
  → EventRepository + SessionRepository reads
  → DTO response (shape defined in domain wire schemas)
  → web-state transforms DTO → web-domain view model → UI render
```

### 5.5 Realtime

`application.publish(event)` → `EventBus` (in-memory impl in adapter-ws) →
subscribed clients → `web-io.realtime` → `web-state` cache invalidation.

`EventBus` is a port — in-memory implementation now, replaceable with Redis or
multi-process later without touching application.

### 5.6 Error handling per layer

| Layer | Behavior |
|---|---|
| `domain` | Throws named errors for invariant violations |
| `classification` | Never throws; returns nullable / union result |
| `application` | Named errors; never HTTP-aware |
| `adapter-http-*` | Only layer that translates to HTTP status (NestJS exception filters) |
| `adapter-sqlite` | Wraps raw DB errors into `RepositoryError` |
| `adapter-ws` | Swallows per-connection errors + logs; never propagates to other subscribers |
| `runtime-claude` | **Never crashes Claude Code.** All errors → `.claude/hooks.log`, exit 0 |

---

## 6. Migration Roadmap

### Phase 0 — Preparation (documentation only)
- Add `docs/ARCHITECTURE.md` summarizing target graph + rules
- Install `dependency-cruiser`; initial config is **warning only**
- Generate `docs/deps.svg` on each PR

**Exit:** `npm run lint:deps` runs in CI; no failures.

### Phase 1 — Carve `@monitor/domain`
- Create `packages/domain/`
- Move: `packages/core/src/domain/*`, `shared/*` (pure), `interop/*`, types from `monitoring/`
- `@monitor/core` re-exports from `@monitor/domain` (shim)
- Update all type imports across repo

**Exit:** build + tests green; add dep-cruiser rule `domain-is-pure` (error).

### Phase 2 — Carve `@monitor/classification`
- Create `packages/classification/`
- Move: `packages/core/src/classification/*`
- `.claude/plugin/hooks/classification/` remains (removed in Phase 6)

**Exit:** add rule `classification-depends-on-domain-only`.

### Phase 3 — Carve `@monitor/application` + define ports
- Create `packages/application/`
- Move: `packages/server/src/application/*`, `core/src/workflow/*`, logic from `core/src/runtime/*`
- Define port interfaces; server keeps temporary inline port implementations

**Exit:** add rule `application-no-adapter`. Highest cognitive load of the project.

### Phase 4 — Driven adapters
- **4a:** `@monitor/adapter-sqlite` ← `server/src/infrastructure/sqlite/*`
- **4b:** `@monitor/adapter-embedding` ← `server/src/infrastructure/embedding/*`
- Server DI-composes the new adapters

**Exit:** add rule `no-cross-adapter`.

### Phase 5 — Driving adapters + classification relocation
- **5a:** `@monitor/adapter-http-ingest` ← write routes
- **5b:** `@monitor/adapter-http-query` ← read routes
- **5c:** `@monitor/adapter-ws` ← websocket
- **5d:** Insert `classification` call inside `IngestEventUseCase`; server accepts
  both classified-inline (legacy plugin) and raw payloads

**Exit:** server-side classification works on raw payloads. Wire is backwards-compatible.

### Phase 6 — Hook plugin formalization
- Move `.claude/plugin/` → `packages/runtime-claude/` (add to workspaces)
- Delete `runtime-claude/classification/` directory
- Plugin refactored to send raw payloads
- Delete `.session-cache/*-metadata.json`, `~/.claude/.session-history.json` usage
- `.claude/plugin/` becomes build output (copied/linked from `packages/runtime-claude/`)
- Plugin version: `v0.2.0` (major — wire contract change)

**Exit:** add rule `runtime-claude-wire-only`; CI fails if classification directory
exists inside runtime-claude.

### Phase 7 — MCP adapter normalization
- Rename `packages/mcp` → `packages/adapter-mcp`
- MCP handlers receive use-case factories as deps
- Extract any application logic up into `application`

**Exit:** adapter-mcp follows allow-list.

### Phase 8 — Web normalization
- Rename `packages/web` → `packages/web-app`
- Scrub any leaked server imports; route everything through `web-io`
- Convert singleton stores to factory (`createUiStore()`)

**Exit:** add rule `web-isolated`.

### Phase 9 — Final lock
- Promote all dep-cruiser rules to error mode
- `tsconfig.json` strict project references (`composite: true`)
- Apply `exports` field to all packages
- Delete `packages/core/` entirely (shim no longer needed)
- Embed final `docs/deps.svg` in `README.md`
- **Acceptance:** manually insert 3 rule-violating imports; verify CI fails on all.

### Phase splitting
- Phase 5 ships as 4 separate PRs (5a–5d).
- Phase 3 may be further decomposed if port surface requires deeper design.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Plugin / server version mismatch in production observation pipeline | Phase 5 server accepts both payload shapes; plugin upgrade deferred to Phase 6 |
| `@monitor/core` shim leaves ambiguous source of truth | Each phase ends with a grep-based sweep ensuring no non-shim content in `core` |
| Workspaces mutation breaks `package-lock.json` | `npm install --lockfile-only` at the top of each phase PR |
| Claude adds code to wrong package mid-migration | Phase 0 ships `CLAUDE.md` note stating the current phase and allowed boundaries |

---

## 8. Testing Strategy

| Layer | Strategy |
|---|---|
| `domain` | `fast-check` property-based tests on invariants |
| `classification` | Fixture table tests |
| `application` | Use-case tests with in-memory fake ports |
| `adapter-sqlite` | Real file-backed SQLite integration |
| `adapter-http-*` | `supertest` against real Express router |
| `adapter-ws` | Real WS client integration |
| `adapter-mcp` | stdio pipe fixture |
| `runtime-claude` | Golden tests: stdin JSON fixture → HTTP call assertion |
| `web-*` | `vitest` + testing-library; inject fake client into `web-io` factory |

### CI gates (final)

1. `tsc --build` across project references
2. `dependency-cruiser --validate` (error mode)
3. `eslint`
4. `vitest run --workspaces`
5. `docs/deps.svg` regeneration diff check

### End-to-end acceptance (Phase 9)

Boot server → runtime-claude sends synthetic ingest → web dashboard displays →
MCP query returns identical data. Three intentional rule violations confirmed
to fail CI, then reverted.

---

## 9. Out of Scope (handled in Spec 2)

- Intra-package layering (e.g., `application`'s internal subfolders)
- Public barrel size reduction per-package
- tsconfig `paths` aliases for internal module boundaries

These become tractable only after the outer package boundaries are enforced.

---

## 10. Approval Log

- Scope (option 3 — both boundary + layering; sequential): **approved**
- Blast radius A (breaking changes OK): **approved**
- Approach 1 (hexagonal): **approved**
- Sections 1–6 (package graph, rules, contracts, data flow, migration, testing): **approved**

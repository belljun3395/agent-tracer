# Architecture — Package Dependency Rules

> Authoritative source: `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md`
> Current migration phase: **Phase 4 (driven-side adapters carved: `adapter-sqlite`, `adapter-embedding`)**

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
| `@monitor/hook-plugin` | `domain` (wire schemas only) |
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
- `hook-plugin` importing `application` or `classification`
- `web-*` importing `server`, adapters, or `application`

## Enforcement

1. `tsc --build` — TypeScript project references
2. `npm run lint:deps` — dependency-cruiser validation
3. `exports` field in every `package.json` — blocks subpath imports at resolver

During the Phase 0–9 migration these rules roll out gradually as **warnings first**, then upgrade to errors once each phase passes. See `.dependency-cruiser.cjs` for which rules are `error` vs `warn` today.

## Current phase notes

- `@monitor/domain`, `@monitor/classification`, `@monitor/application`, `@monitor/adapter-sqlite`, and `@monitor/adapter-embedding` exist; `@monitor/core` re-exports from the first three as a transitional facade.
- `IEmbeddingService` is now an `@monitor/application` port (carries a `modelId` identifier so persisted rows declare which model produced their vectors). `adapter-sqlite` consumes it; `adapter-embedding` provides the local `LocalEmbeddingService` implementation.
- Enforced as errors: `domain-is-pure`, `classification-depends-on-domain-only`, `application-inner-ring`, `no-cross-adapter`, `hook-plugin-wire-only` (Phase 6).
- Remaining rules (`application-no-adapter`, `web-isolated`, `no-subpath-imports`) stay in warning-mode until Phase 9 lock.
- `@monitor/claude-plugin` v0.2.0 removes all client-side semantic classification and FS state (session cache, metadata, history). Every hook posts raw payloads; the server classifies at ingestion via `@monitor/classification`. The only plugin-local state is the per-session transcript cursor at `.claude/.transcript-cursors/<sid>.json`.
- New code should import from `@monitor/domain` / `@monitor/classification` / `@monitor/application` / `@monitor/adapter-*` directly. Existing imports via `@monitor/core` remain functional.
- Pre-existing tech debt: several packages suffer "leaky dist" — `tsc`'s `rootDir` inflates when `paths` mapping leads out of `src/`, so `dist/<pkg>/src/*.js` layout diverges from each `package.json`'s `main: "./dist/index.js"`. This blocks production `vite build` but has no effect on `lint`/`lint:deps`/`test`, which is what CI gates on. Phase 9 will resolve via TypeScript project references and/or per-package bundling.

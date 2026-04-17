# Architecture — Package Dependency Rules

> Authoritative source: `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md`
> Current migration phase: **Phase 1 (domain carve-out in progress)**

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

- `@monitor/domain` exists; `@monitor/core` re-exports from it.
- Full rule set is warning-mode until Phase 9 lock.
- New code should import from `@monitor/domain` directly when possible. Existing imports via `@monitor/core` remain functional.

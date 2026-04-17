# Phase 4 — Driven adapters (`adapter-sqlite`, `adapter-embedding`)

> Spec: `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md` §Phase 4
> Exit: `no-cross-adapter` rule promoted to error.
> Prerequisite: Phase 3 complete (commit `8fed244`).

## Goal

Extract the two driven adapters currently living inside
`packages/server/src/infrastructure/` into independent packages so that
server becomes pure DI composition, and neither adapter depends on the
other.

- `packages/server/src/infrastructure/sqlite/*` → `packages/adapter-sqlite/src/`
- `packages/server/src/infrastructure/embedding/*` → `packages/adapter-embedding/src/`

## Architectural decisions

### Decision 1: Promote `IEmbeddingService` to `@monitor/application`

Today `IEmbeddingService` is declared inside
`server/src/infrastructure/embedding/embedding-service.ts`. Two SQLite
repositories (`SqliteEvaluationRepository`, `SqliteEventRepository`)
accept it via constructor injection. Leaving the port in
`adapter-embedding` would force `adapter-sqlite` to import
`@monitor/adapter-embedding` at the type level — a direct
`no-cross-adapter` violation.

Fix: move the **interface** into `@monitor/application` as a port
(`packages/application/src/ports/embedding-service.ts`). Both adapters
then depend only on application + domain.

### Decision 2: `cosineSimilarity` / `(de)serializeEmbedding` stay with `adapter-sqlite`

These helpers are pure `Float32Array` math + JSON encoding, but are
used exclusively by `adapter-sqlite` (the evaluation/event repositories
compute semantic search scores locally and store vectors as JSON).
They are storage-codec concerns, not embedding-production concerns.

Moving them into `adapter-sqlite/src/embedding-codec.ts` avoids
duplicate logic, avoids a cross-adapter import, and avoids polluting
`@monitor/application` with Float32Array serializer utilities.

### Decision 3: Tests move with their adapters

All `packages/server/test/infrastructure/sqlite-*.test.ts` and
`embedding-service.test.ts` become `packages/adapter-*/test/*.test.ts`.
Server keeps only tests that exercise the HTTP/WS/DI composition.

## Execution steps

### Step 4.0 — Promote port (in place, no moves yet)

1. Create `packages/application/src/ports/embedding-service.ts`:
   ```ts
   export interface IEmbeddingService {
     embed(text: string): Promise<Float32Array>;
   }
   ```
2. Re-export from `packages/application/src/ports/index.ts`.
3. Switch `server/src/infrastructure/sqlite/*.ts` imports from
   `"../embedding"` → `"@monitor/application"` for the type, leaving
   the concrete service creation untouched.
4. Delete the `IEmbeddingService` interface from
   `server/src/infrastructure/embedding/embedding-service.ts` and
   re-export from `@monitor/application` instead (so
   `createEmbeddingService()` still returns the right type and any
   `import { IEmbeddingService } from ".../embedding"` still resolves
   transitionally).
5. Verify: `npm run lint`, `npm test`, `npm run lint:deps` all green.

### Step 4a — Carve `@monitor/adapter-sqlite`

1. Scaffold `packages/adapter-sqlite/`:
   - `package.json` with deps: `@monitor/application`, `@monitor/core`
     (only if transitional facade types are still needed — prefer
     `@monitor/domain` direct), `better-sqlite3`, `drizzle-orm`;
     devDeps: `@types/better-sqlite3`, `vitest`, `typescript`
   - `tsconfig.json` extending base
   - `tsconfig.test.json`
   - `vitest.config.ts`
   - `src/index.ts` (barrel)
2. `git mv packages/server/src/infrastructure/sqlite/*` → `packages/adapter-sqlite/src/`
3. Move `packages/server/src/infrastructure/embedding/cosine-similarity.ts`
   → `packages/adapter-sqlite/src/embedding-codec.ts` (co-located
   storage helper).
4. Rewrite imports inside the moved files:
   - `"../embedding"` type → `"@monitor/application"` (already done in 4.0)
   - `"../embedding"` codec → `"./embedding-codec.js"`
   - `"@monitor/application"` absolute imports for port types
5. `git mv packages/server/test/infrastructure/sqlite-*.test.ts` →
   `packages/adapter-sqlite/test/`
6. Add `@monitor/adapter-sqlite` to `tsconfig.base.json` `paths`.
7. In `packages/server/package.json`: add `"@monitor/adapter-sqlite": "*"`.
8. Rewire `server/src/seed.ts`, `server/src/presentation/database/database.provider.ts`,
   `server/test/test-helpers.ts`, remaining `sqlite-*.test.ts` files
   to import from `@monitor/adapter-sqlite`.

### Step 4b — Carve `@monitor/adapter-embedding`

1. Scaffold `packages/adapter-embedding/` (same shape as adapter-sqlite).
2. `git mv packages/server/src/infrastructure/embedding/embedding-service.ts`
   → `packages/adapter-embedding/src/`
3. Drop the duplicated `IEmbeddingService` interface definition (the
   port lives in `@monitor/application`); `LocalEmbeddingService
   implements IEmbeddingService` imported from application.
4. `git mv packages/server/test/infrastructure/embedding-service.test.ts`
   → `packages/adapter-embedding/test/`
5. Add `@monitor/adapter-embedding` to `tsconfig.base.json` paths.
6. In `packages/server/package.json`: add `"@monitor/adapter-embedding": "*"`.
7. Rewire `server/src/presentation/database/database.provider.ts`
   to import `createEmbeddingService` from `@monitor/adapter-embedding`.

### Step 4c — Cleanup

1. Delete empty `packages/server/src/infrastructure/` tree.
2. Delete empty `packages/server/test/infrastructure/` tree (if empty).
3. Update `docs/ARCHITECTURE.md` to "Phase 4 (driven adapters complete)".

### Step 4d — Enforcement

1. In `.dependency-cruiser.cjs`:
   - `no-cross-adapter`: `warn` → `error`
   - `application-no-adapter`: `warn` → `error`
2. Run `npm run lint:deps` — expect zero violations.
3. Run `npm run lint`, `npm test` — all green.
4. Commit.

## Out of scope

- Fixing "leaky dist" tech debt (Phase 9).
- Carving `@monitor/adapter-http-*` / `adapter-ws` (Phase 5).
- Renaming `packages/mcp` (Phase 7) or `packages/web` (Phase 8).

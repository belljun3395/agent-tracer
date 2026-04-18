# Phase 3: Carve `@monitor/application` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the application layer (use cases + port interfaces) into a new `@monitor/application` package. Move `packages/server/src/application/**`, `packages/core/src/workflow/**`, and the logic portion of `packages/core/src/runtime/**`. Split runtime **types** into `@monitor/domain` so application stays within its allow-list (`domain`, `classification`). `@monitor/core` becomes a facade re-exporting from `@monitor/application` for backwards compatibility with the web/web-domain packages (Phase 8 decouples them).

**Tech Stack:** TypeScript 5, npm workspaces, `dependency-cruiser`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md` (Phase 3)

**Prerequisites:** Phase 0, 1, 2 complete.

---

## File Structure

### New package
- `packages/application/package.json` — `@monitor/application@0.1.0`, deps: `@monitor/domain`, `@monitor/classification`
- `packages/application/tsconfig.json`
- `packages/application/tsconfig.test.json`
- `packages/application/vitest.config.ts`
- `packages/application/src/index.ts` — explicit barrel

### Moves (from → to)

**Runtime types → `@monitor/domain`**
- `packages/core/src/runtime/capabilities.types.ts` → `packages/domain/src/runtime/capabilities.types.ts`

**Runtime logic + workflow → `@monitor/application`**
- `packages/core/src/runtime/capabilities.constants.ts` → `packages/application/src/runtime/capabilities.constants.ts`
- `packages/core/src/runtime/capabilities.defaults.ts` → `packages/application/src/runtime/capabilities.defaults.ts`
- `packages/core/src/runtime/capabilities.helpers.ts` → `packages/application/src/runtime/capabilities.helpers.ts`
- `packages/core/src/runtime/evidence.ts` → `packages/application/src/runtime/evidence.ts`
- `packages/core/src/runtime/index.ts` → `packages/application/src/runtime/index.ts`
- `packages/core/src/workflow/context.ts` → `packages/application/src/workflow/context.ts`
- `packages/core/src/workflow/segments.ts` → `packages/application/src/workflow/segments.ts`
- `packages/core/src/workflow/snapshot.ts` → `packages/application/src/workflow/snapshot.ts`
- `packages/core/src/workflow/index.ts` → `packages/application/src/workflow/index.ts`
- `packages/core/src/workflow/snapshot.test.ts` → `packages/application/src/workflow/snapshot.test.ts`
- `packages/core/src/workflow/segments.test.ts` → `packages/application/src/workflow/segments.test.ts`

**Server application layer → `@monitor/application`**
- `packages/server/src/application/**` → `packages/application/src/**` (top-level files + `ports/` + `services/`; preserve subdirectory structure)

### Modified files
- `packages/domain/src/index.ts` — add `./runtime/capabilities.types.js` export
- `packages/core/package.json` — add `@monitor/application` dependency
- `packages/core/src/runtime.ts` — shim `export * from "@monitor/application"` (types flow through `@monitor/domain` re-export in `index.ts`)
- `packages/core/src/workflow.ts` — shim `export * from "@monitor/application"`
- `packages/core/src/index.ts` — keep `registerDefaultRuntimeAdapters` auto-init call working through the shim
- `packages/server/package.json` — add `@monitor/application` dependency
- `packages/server/src/presentation/app.module.ts`
- `packages/server/src/presentation/service/monitor-service.provider.ts`
- `packages/server/src/presentation/database/database.provider.ts`
- `packages/server/src/presentation/ws/event-broadcaster.ts`
- `packages/server/src/presentation/controllers/{event,evaluation,search,lifecycle,bookmark,ingest}.controller.ts`
- `packages/server/src/infrastructure/sqlite/*.ts` (7 files)
- `packages/server/src/bootstrap/runtime.types.ts`
- `packages/server/test/test-helpers.ts`
- `packages/server/test/application/session-lifecycle-policy.test.ts`
- `packages/server/test/application/observability.test.ts`
- `tsconfig.base.json` — add `@monitor/application` path mapping
- `.dependency-cruiser.cjs` — add `application-no-adapter` rule
- `docs/ARCHITECTURE.md` — phase note update

### Deleted (empty after moves)
- `packages/core/src/workflow/` directory
- `packages/core/src/runtime/` directory
- `packages/server/src/application/` directory

---

## Task 1: Scaffold `packages/application/`

- [ ] **Step 1: Create `packages/application/package.json`**

```json
{
  "name": "@monitor/application",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "development": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint src && npm run lint:types",
    "lint:types": "tsc -p tsconfig.test.json --noEmit",
    "test": "vitest run --passWithNoTests"
  },
  "dependencies": {
    "@monitor/classification": "*",
    "@monitor/domain": "*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/application/tsconfig.json`** (no rootDir, matching core pattern)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/application/tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `packages/application/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 5: Create placeholder `packages/application/src/index.ts`**

```ts
export {};
```

- [ ] **Step 6: `npm install`** — expect `node_modules/@monitor/application` symlink

---

## Task 2: Move runtime types to domain

- [ ] **Step 1: `git mv` capabilities.types.ts to domain**

```bash
mkdir -p packages/domain/src/runtime
git mv packages/core/src/runtime/capabilities.types.ts packages/domain/src/runtime/capabilities.types.ts
```

- [ ] **Step 2: Add to `packages/domain/src/index.ts` barrel**

Add line:
```ts
export * from "./runtime/capabilities.types.js";
```

- [ ] **Step 3: Build domain** — must succeed

```bash
npm run build --workspace @monitor/domain
```

---

## Task 3: Move runtime logic + workflow + server application

- [ ] **Step 1: Create target directories**

```bash
mkdir -p packages/application/src/runtime packages/application/src/workflow packages/application/src/ports packages/application/src/services
```

- [ ] **Step 2: Move runtime logic**

```bash
git mv packages/core/src/runtime/capabilities.constants.ts packages/application/src/runtime/capabilities.constants.ts
git mv packages/core/src/runtime/capabilities.defaults.ts  packages/application/src/runtime/capabilities.defaults.ts
git mv packages/core/src/runtime/capabilities.helpers.ts   packages/application/src/runtime/capabilities.helpers.ts
git mv packages/core/src/runtime/evidence.ts               packages/application/src/runtime/evidence.ts
git mv packages/core/src/runtime/index.ts                  packages/application/src/runtime/index.ts
```

- [ ] **Step 3: Move workflow**

```bash
git mv packages/core/src/workflow/context.ts       packages/application/src/workflow/context.ts
git mv packages/core/src/workflow/segments.ts      packages/application/src/workflow/segments.ts
git mv packages/core/src/workflow/snapshot.ts      packages/application/src/workflow/snapshot.ts
git mv packages/core/src/workflow/index.ts         packages/application/src/workflow/index.ts
git mv packages/core/src/workflow/segments.test.ts packages/application/src/workflow/segments.test.ts
git mv packages/core/src/workflow/snapshot.test.ts packages/application/src/workflow/snapshot.test.ts
```

- [ ] **Step 4: Move server/src/application top-level files**

```bash
git mv packages/server/src/application/monitor-service.ts                      packages/application/src/monitor-service.ts
git mv packages/server/src/application/observability-overview-analyzer.ts     packages/application/src/observability-overview-analyzer.ts
git mv packages/server/src/application/observability-task-analyzer.ts         packages/application/src/observability-task-analyzer.ts
git mv packages/server/src/application/observability.ts                       packages/application/src/observability.ts
git mv packages/server/src/application/observability.types.ts                 packages/application/src/observability.types.ts
git mv packages/server/src/application/types.ts                               packages/application/src/types.ts
git mv packages/server/src/application/workflow-context-builder.constants.ts  packages/application/src/workflow-context-builder.constants.ts
```

- [ ] **Step 5: Move server/src/application/ports**

```bash
git mv packages/server/src/application/ports/* packages/application/src/ports/
rmdir packages/server/src/application/ports
```

- [ ] **Step 6: Move server/src/application/services**

```bash
git mv packages/server/src/application/services/* packages/application/src/services/
rmdir packages/server/src/application/services
rmdir packages/server/src/application
```

---

## Task 4: Fix imports inside moved files

- [ ] **Step 1: Runtime logic — runtime types now from `@monitor/domain`**

In `packages/application/src/runtime/capabilities.constants.ts`, `capabilities.defaults.ts`, `capabilities.helpers.ts`, `evidence.ts`, `index.ts`:
- Replace `from "./capabilities.types.js"` → `from "@monitor/domain"`

- [ ] **Step 2: Server application files — `@monitor/core` imports for workflow helpers**

Any file in `packages/application/src/**` that imports `buildReusableTaskSnapshot`, `buildWorkflowContext`, `segmentEventsByTurn` from `@monitor/core` must swap to sibling relative paths:
- `from "@monitor/core"` for workflow helpers → `from "./workflow/snapshot.js"` etc., **or** a self-barrel import `from "./workflow/index.js"`.

Candidate files: `services/workflow-evaluation-service.ts`, `observability-task-analyzer.ts`.

Keep domain/classification imports via `@monitor/core` acceptable for this phase (they'll resolve cleanly). Simpler rule: leave `@monitor/core` imports alone **except** for symbols that now live in `@monitor/application` itself (avoid self-cycle).

- [ ] **Step 3: Workflow files — types from `@monitor/domain`**

Already fine; `context.ts`/`snapshot.ts`/`segments.ts` already import `TimelineEvent` etc. from `@monitor/domain`.

---

## Task 5: Write `packages/application/src/index.ts` barrel

Replace placeholder with an explicit barrel re-exporting the public surface:

```ts
// Types (use-case inputs + observability DTOs)
export * from "./types.js";
export * from "./observability.types.js";

// Orchestrator + use-case-flavoured helpers
export * from "./monitor-service.js";
export * from "./observability.js";
export * from "./observability-overview-analyzer.js";
export * from "./observability-task-analyzer.js";

// Workflow builders (pure)
export * from "./workflow/index.js";

// Runtime registry + evidence
export * from "./runtime/index.js";

// Ports
export * from "./ports/index.js";

// Services (recorders, resolvers, policies, factories)
export * from "./services/event-ingestion-service.js";
export * from "./services/event-logging-service.js";
export * from "./services/event-recorder.js";
export * from "./services/event-recorder.helpers.js";
export * from "./services/event-recorder.constants.js";
export * from "./services/session-lifecycle-policy.js";
export * from "./services/task-display-title-resolver.helpers.js";
export * from "./services/task-display-title-resolver.constants.js";
export * from "./services/task-lifecycle-service.js";
export * from "./services/trace-metadata-factory.js";
export * from "./services/trace-metadata-factory.helpers.js";
export * from "./services/workflow-evaluation-service.js";
```

Build: `npm run build --workspace @monitor/application` — must succeed.

---

## Task 6: Core shim (`runtime.ts` + `workflow.ts`)

- [ ] **Step 1: `packages/core/src/runtime.ts`** — replace content with:

```ts
export * from "@monitor/application";
```

- [ ] **Step 2: `packages/core/src/workflow.ts`** — replace content with:

```ts
export * from "@monitor/application";
```

- [ ] **Step 3: `packages/core/package.json`** — add `@monitor/application` to `dependencies`:

```json
"dependencies": {
  "@monitor/application": "*",
  "@monitor/classification": "*",
  "@monitor/domain": "*",
  "yaml": "^2.0.0",
  "zod": "^3.0.0"
}
```

- [ ] **Step 4: Verify `core/src/index.ts`** still auto-inits the adapter registry — `registerDefaultRuntimeAdapters()` is re-exported through the shim; no change needed to `index.ts`.

- [ ] **Step 5: Delete empty core dirs**

```bash
rmdir packages/core/src/runtime packages/core/src/workflow
```

---

## Task 7: Rewire server imports

- [ ] **Step 1: Add `@monitor/application` to `packages/server/package.json`** dependencies

- [ ] **Step 2: Update presentation files** — replace `../../application/...` / `../application/...` imports with `@monitor/application`

Files:
- `packages/server/src/presentation/app.module.ts`
- `packages/server/src/presentation/service/monitor-service.provider.ts`
- `packages/server/src/presentation/database/database.provider.ts`
- `packages/server/src/presentation/ws/event-broadcaster.ts`
- `packages/server/src/presentation/controllers/event.controller.ts`
- `packages/server/src/presentation/controllers/evaluation.controller.ts`
- `packages/server/src/presentation/controllers/search.controller.ts`
- `packages/server/src/presentation/controllers/lifecycle.controller.ts`
- `packages/server/src/presentation/controllers/bookmark.controller.ts`
- `packages/server/src/presentation/controllers/ingest.controller.ts`

- [ ] **Step 3: Update bootstrap** — `packages/server/src/bootstrap/runtime.types.ts`

- [ ] **Step 4: Update infrastructure/sqlite** — replace deep-path imports with `@monitor/application`

Files:
- `packages/server/src/infrastructure/sqlite/index.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-event-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-session-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-task-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-runtime-binding-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-bookmark-repository.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-evaluation-repository.ts`

- [ ] **Step 5: Update tests**

Files:
- `packages/server/test/test-helpers.ts`
- `packages/server/test/application/session-lifecycle-policy.test.ts`
- `packages/server/test/application/observability.test.ts`

- [ ] **Step 6: Grep sweep**

```bash
grep -rn '"\.\./\.\./application\|"\.\./application\|"\.\./\.\./\.\./application' packages/server/ || true
```

Expected: no output.

---

## Task 8: tsconfig path mapping and dep-cruiser rule

- [ ] **Step 1: Add path mapping in `tsconfig.base.json`**

```json
"@monitor/application": [
  "packages/application/src/index.ts"
],
```

- [ ] **Step 2: Add `application-no-adapter` is already present** (warn). Additionally add `application-depends-only-on-domain-and-classification`:

```js
{
  name: "application-inner-ring",
  severity: "warn",
  comment: "@monitor/application may only depend on @monitor/domain and @monitor/classification.",
  from: { path: "^packages/application/" },
  to:   { path: "^packages/(?!(domain|classification|application)/)" },
},
```

---

## Task 9: Verify and promote rule

- [ ] **Step 1: `npm install`**
- [ ] **Step 2: `npm run build`** — all green
- [ ] **Step 3: `npm run lint`** — green
- [ ] **Step 4: `npm test`** — green
- [ ] **Step 5: `npm run lint:deps`** — expect zero violations; promote `application-inner-ring` to `error` and re-run

---

## Task 10: ARCHITECTURE.md and commit

- [ ] **Step 1: Update `docs/ARCHITECTURE.md`** — phase note to `Phase 3 (application carve-out complete)`; add note that `application-inner-ring` is enforced.

- [ ] **Step 2: Stage Phase 3 files only** (exclude `2026-04-16-library-signal-enrichment.md`)

- [ ] **Step 3: Commit**

```
Carve @monitor/application out of core + server (hexagonal Phase 3)
```

---

# Acceptance Criteria

- [ ] `packages/application/` exists; depends only on `@monitor/domain` + `@monitor/classification`.
- [ ] `packages/core/src/runtime/` and `packages/core/src/workflow/` are gone.
- [ ] `packages/server/src/application/` is gone.
- [ ] `@monitor/core` still exports workflow + runtime symbols via shim for web.
- [ ] `application-inner-ring` rule enforced as error with zero violations.
- [ ] `npm run build`, `npm run lint`, `npm run lint:deps`, `npm test` all green.

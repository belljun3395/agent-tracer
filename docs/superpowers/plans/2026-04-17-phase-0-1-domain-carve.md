# Phase 0 + 1: Dependency Tooling & `@monitor/domain` Carve-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish dependency enforcement tooling (Phase 0) and extract pure types into a new `@monitor/domain` package while keeping `@monitor/core`'s public API backwards-compatible via re-exports (Phase 1).

**Architecture:** `packages/domain/` becomes the new inner ring. `packages/core/` remains as a facade that re-exports from `@monitor/domain` plus its still-owned logic (classification/runtime/workflow/paths). No downstream import paths change — they keep using `@monitor/core`. Only the internal file topology of `packages/core/src/` shrinks, and a new `@monitor/domain` package appears.

**Tech Stack:** TypeScript 5 project references, npm workspaces, `dependency-cruiser`, `zod`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md` (Phases 0 + 1)

---

## File Structure

### New files
- `docs/ARCHITECTURE.md` — target package graph, rules matrix, current migration phase status
- `.dependency-cruiser.cjs` — root dependency-cruiser config, all rules as `warn`
- `packages/domain/package.json` — `@monitor/domain@0.1.0`
- `packages/domain/tsconfig.json` — references-enabled
- `packages/domain/src/index.ts` — explicit barrel
- `packages/domain/src/shared/string-brands.ts`
- `packages/domain/src/monitoring/ids.ts`
- `packages/domain/src/monitoring/types.ts`
- `packages/domain/src/monitoring/utils.ts`
- `packages/domain/src/classification/ids.ts`
- `packages/domain/src/classification/types.ts`
- `packages/domain/src/workflow/ids.ts`
- `packages/domain/src/workflow/types.ts`
- `packages/domain/src/paths/utils.ts`
- `packages/domain/vitest.config.ts`
- `packages/domain/tsconfig.test.json`

### Modified files
- `package.json` (root) — add `dependency-cruiser` devDep; add `lint:deps` + `depgraph` scripts
- `tsconfig.base.json` — add `@monitor/domain` path mapping
- `.github/workflows/ci.yml` — insert `npm run lint:deps` step after `lint`
- `packages/core/package.json` — add `@monitor/domain` as dependency
- `packages/core/src/index.ts` — re-export from `@monitor/domain`
- `packages/core/src/monitoring.ts` — re-export from `@monitor/domain`
- `packages/core/src/classification/classifier.ts` — change `../monitoring/*` imports to `@monitor/domain`
- `packages/core/src/classification/classifier.types.ts` — same
- `packages/core/src/classification/classifier.helpers.ts` — same
- `packages/core/src/classification/action-registry.types.ts` — same
- `packages/core/src/classification/types.ts` (if retained) — same
- `packages/core/src/workflow/types.ts` (if retained) — same
- `packages/core/src/workflow/snapshot.ts`, `context.ts`, `segments.ts` — same
- `packages/core/src/workflow/snapshot.test.ts`, `segments.test.ts` — same
- `packages/core/src/runtime/evidence.ts` — same
- `packages/core/src/interop/openinference.ts` — same

### Deleted files (moved to domain)
- `packages/core/src/shared/string-brands.ts`
- `packages/core/src/monitoring/ids.ts`
- `packages/core/src/monitoring/types.ts`
- `packages/core/src/monitoring/utils.ts`
- `packages/core/src/classification/ids.ts`
- `packages/core/src/classification/types.ts`
- `packages/core/src/workflow/ids.ts`
- `packages/core/src/workflow/types.ts`
- `packages/core/src/paths/utils.ts`

---

# PHASE 0 — Tooling & Documentation (tasks 1–3)

## Task 1: Write `docs/ARCHITECTURE.md`

**Files:**
- Create: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Create the architecture doc**

```markdown
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
- Subpath imports (`@monitor/foo/src/bar`)
- `domain` importing any other `@monitor/*` package
- `hook-plugin` importing `application` or `classification`
- `web-*` importing `server` or adapters

## Enforcement

1. `tsc --build` — TypeScript project references
2. `npm run lint:deps` — dependency-cruiser validation
3. `exports` field in every `package.json` — blocks subpath imports at resolver

During the Phase 0–9 migration these rules roll out gradually as **warnings first**, then upgrade to errors once each phase passes. See `.dependency-cruiser.cjs` for which rules are `error` vs `warn` today.

## Current phase notes

- `@monitor/domain` exists; `@monitor/core` re-exports from it.
- Full rule set is warning-mode until Phase 9 lock.
- New code should import from `@monitor/domain` directly when possible. Existing imports via `@monitor/core` remain functional.
```

- [ ] **Step 2: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: add ARCHITECTURE.md for package dependency rules"
```

---

## Task 2: Install `dependency-cruiser` and write config

**Files:**
- Modify: `package.json`
- Create: `.dependency-cruiser.cjs`

- [ ] **Step 1: Install dependency-cruiser as root devDependency**

Run:
```bash
npm install -D -W dependency-cruiser@^16
```

Expected: `package.json` and `package-lock.json` updated; `node_modules/dependency-cruiser/` present.

- [ ] **Step 2: Create `.dependency-cruiser.cjs` at repo root**

```js
// .dependency-cruiser.cjs
/** @type {import("dependency-cruiser").IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "domain-is-pure",
      severity: "warn",
      comment: "packages/domain must not import any other @monitor/* package.",
      from: { path: "^packages/domain/" },
      to:   { path: "^packages/(?!domain/)" },
    },
    {
      name: "no-cross-adapter",
      severity: "warn",
      comment: "adapter-X must not depend on adapter-Y.",
      from: { path: "^packages/adapter-" },
      to:   { path: "^packages/adapter-" },
    },
    {
      name: "application-no-adapter",
      severity: "warn",
      comment: "application layer must not import adapters.",
      from: { path: "^packages/application/" },
      to:   { path: "^packages/adapter-" },
    },
    {
      name: "hook-plugin-wire-only",
      severity: "warn",
      comment: "hook-plugin may only depend on @monitor/domain (wire schemas).",
      from: { path: "^packages/hook-plugin/" },
      to:   { path: "^packages/(?!domain/)" },
    },
    {
      name: "web-isolated",
      severity: "warn",
      comment: "web-* must not import server, adapters, or application.",
      from: { path: "^packages/web-" },
      to:   { path: "^packages/(application|adapter-|server)/" },
    },
    {
      name: "no-subpath-imports",
      severity: "warn",
      comment: "Import packages via their public barrel only.",
      from: {},
      to:   { path: "@monitor/[^/]+/(src|dist)/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "development"],
    },
    reporterOptions: {
      dot:  { theme: { graph: { rankdir: "LR" } } },
    },
  },
};
```

- [ ] **Step 3: Verify config parses**

Run:
```bash
npx depcruise --validate --config .dependency-cruiser.cjs packages/core/src
```

Expected: command completes without crashing. Warnings are allowed; errors are not.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .dependency-cruiser.cjs
git commit -m "chore: install dependency-cruiser with initial warning-only rules"
```

---

## Task 3: Wire `lint:deps` into scripts and CI

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add scripts to root `package.json`**

In `scripts` object, add:
```json
    "lint:deps": "depcruise --config .dependency-cruiser.cjs packages",
    "depgraph": "depcruise --config .dependency-cruiser.cjs --output-type dot packages | dot -T svg -o docs/deps.svg"
```

Final scripts block (relevant lines):
```json
{
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "lint": "npm run lint --workspaces --if-present",
    "lint:deps": "depcruise --config .dependency-cruiser.cjs packages",
    "depgraph": "depcruise --config .dependency-cruiser.cjs --output-type dot packages | dot -T svg -o docs/deps.svg",
    "test": "npm run test --workspaces --if-present"
  }
}
```

- [ ] **Step 2: Run `lint:deps` locally**

Run:
```bash
npm run lint:deps
```

Expected: exits 0. Some warnings are acceptable (the current repo will emit some since rules are not yet satisfied).

- [ ] **Step 3: Insert lint:deps step in CI**

Modify `.github/workflows/ci.yml`. After the `Lint` step, insert:

```yaml
      - name: Dependency graph lint
        run: npm run lint:deps
```

Full `jobs.lint-and-test.steps` after edit:
```yaml
      - name: Checkout
        uses: actions/checkout@v6

      - name: Setup Node
        uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Dependency graph lint
        run: npm run lint:deps

      - name: Test
        run: npm test
```

- [ ] **Step 4: Commit**

```bash
git add package.json .github/workflows/ci.yml
git commit -m "chore: wire lint:deps and depgraph scripts into CI"
```

---

# PHASE 1 — Carve `@monitor/domain` (tasks 4–11)

## Task 4: Scaffold `packages/domain/` package

**Files:**
- Create: `packages/domain/package.json`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/tsconfig.test.json`
- Create: `packages/domain/vitest.config.ts`
- Create: `packages/domain/src/index.ts` (empty barrel placeholder)

- [ ] **Step 1: Create `packages/domain/package.json`**

```json
{
  "name": "@monitor/domain",
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
    "zod": "^3.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/domain/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/domain/tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `packages/domain/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 5: Create placeholder `packages/domain/src/index.ts`**

```ts
// Intentionally empty placeholder — populated by subsequent tasks.
export {};
```

- [ ] **Step 6: Install workspace (wires npm workspaces)**

Run:
```bash
npm install
```

Expected: `node_modules/@monitor/domain` symlink appears.

- [ ] **Step 7: Verify package builds**

Run:
```bash
npm run build --workspace @monitor/domain
```

Expected: build succeeds, produces `packages/domain/dist/index.js`.

- [ ] **Step 8: Commit**

```bash
git add packages/domain/ package.json package-lock.json
git commit -m "feat(domain): scaffold @monitor/domain package skeleton"
```

---

## Task 5: Move `shared/string-brands.ts` and `monitoring/*` to domain

**Files:**
- Move: `packages/core/src/shared/string-brands.ts` → `packages/domain/src/shared/string-brands.ts`
- Move: `packages/core/src/monitoring/ids.ts` → `packages/domain/src/monitoring/ids.ts`
- Move: `packages/core/src/monitoring/types.ts` → `packages/domain/src/monitoring/types.ts`
- Move: `packages/core/src/monitoring/utils.ts` → `packages/domain/src/monitoring/utils.ts`

- [ ] **Step 1: Move files via `git mv` to preserve history**

Run:
```bash
mkdir -p packages/domain/src/shared packages/domain/src/monitoring
git mv packages/core/src/shared/string-brands.ts packages/domain/src/shared/string-brands.ts
git mv packages/core/src/monitoring/ids.ts       packages/domain/src/monitoring/ids.ts
git mv packages/core/src/monitoring/types.ts     packages/domain/src/monitoring/types.ts
git mv packages/core/src/monitoring/utils.ts     packages/domain/src/monitoring/utils.ts
```

- [ ] **Step 2: Update `monitoring/types.ts` to import `EventClassification` via `@monitor/domain` once classification types move (noted — address in Task 6)**

For now, update line 1 of `packages/domain/src/monitoring/types.ts` to import from a new relative path that will exist after Task 6:

Before:
```ts
import type { EventClassification } from "../classification.js";
```
After:
```ts
import type { EventClassification } from "../classification/types.js";
```

- [ ] **Step 3: Update `monitoring/ids.ts` import path for string-brands**

Before:
```ts
import { ... } from "../shared/string-brands.js";
```
After (unchanged if already relative — verify path resolves):
```ts
import { ... } from "../shared/string-brands.js";
```

Verify the file compiles with `tsc -p packages/domain/tsconfig.json --noEmit` after Task 6 completes. Do not run tsc yet — it will fail here until classification types also move.

- [ ] **Step 4: Do NOT commit yet** — combine with Tasks 6–9 for a single atomic move commit at Task 10.

---

## Task 6: Move `classification/{ids,types}.ts` to domain

**Files:**
- Move: `packages/core/src/classification/ids.ts` → `packages/domain/src/classification/ids.ts`
- Move: `packages/core/src/classification/types.ts` → `packages/domain/src/classification/types.ts`

- [ ] **Step 1: Move files**

Run:
```bash
mkdir -p packages/domain/src/classification
git mv packages/core/src/classification/ids.ts   packages/domain/src/classification/ids.ts
git mv packages/core/src/classification/types.ts packages/domain/src/classification/types.ts
```

- [ ] **Step 2: Update `classification/ids.ts` import path for shared**

Before:
```ts
import { ... } from "../shared/string-brands.js";
```
After:
```ts
import { ... } from "../shared/string-brands.js";
```

(Relative path resolves within the new package; verify by inspection.)

- [ ] **Step 3: Update `classification/types.ts` monitoring import**

Before:
```ts
import type { TimelineLane } from "../monitoring/types.js";
```
After (unchanged — now sibling inside same package):
```ts
import type { TimelineLane } from "../monitoring/types.js";
```

- [ ] **Step 4: Do NOT commit yet.**

---

## Task 7: Move `workflow/{ids,types}.ts` to domain

**Files:**
- Move: `packages/core/src/workflow/ids.ts` → `packages/domain/src/workflow/ids.ts`
- Move: `packages/core/src/workflow/types.ts` → `packages/domain/src/workflow/types.ts`

- [ ] **Step 1: Move files**

Run:
```bash
mkdir -p packages/domain/src/workflow
git mv packages/core/src/workflow/ids.ts   packages/domain/src/workflow/ids.ts
git mv packages/core/src/workflow/types.ts packages/domain/src/workflow/types.ts
```

- [ ] **Step 2: Update imports in moved files**

In `packages/domain/src/workflow/ids.ts` and `packages/domain/src/workflow/types.ts`, ensure all `../monitoring/*` and `../shared/*` imports now resolve within `packages/domain/src/` (they should, since siblings moved).

- [ ] **Step 3: Do NOT commit yet.**

---

## Task 8: Move `paths/utils.ts` to domain

**Files:**
- Move: `packages/core/src/paths/utils.ts` → `packages/domain/src/paths/utils.ts`

- [ ] **Step 1: Move file**

Run:
```bash
mkdir -p packages/domain/src/paths
git mv packages/core/src/paths/utils.ts packages/domain/src/paths/utils.ts
```

- [ ] **Step 2: Do NOT commit yet.**

---

## Task 9: Write `packages/domain/src/index.ts` barrel

**Files:**
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write the explicit barrel**

Replace the placeholder with:

```ts
// Shared primitives
export * from "./shared/string-brands.js";

// Monitoring (core ids + types)
export * from "./monitoring/ids.js";
export * from "./monitoring/types.js";
export * from "./monitoring/utils.js";

// Classification value types (pure)
export * from "./classification/ids.js";
export * from "./classification/types.js";

// Workflow value types (pure)
export * from "./workflow/ids.js";
export * from "./workflow/types.js";

// Path utilities (pure)
export * from "./paths/utils.js";
```

- [ ] **Step 2: Verify domain package compiles standalone**

Run:
```bash
npm run build --workspace @monitor/domain
```

Expected: compiles cleanly. If any `../classification.js` or similar barrel-style relative import leaks, fix to explicit sibling paths like `../classification/types.js`.

- [ ] **Step 3: Do NOT commit yet.**

---

## Task 10: Update `packages/core` to import from `@monitor/domain`

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/monitoring.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/core/src/classification/classifier.ts`
- Modify: `packages/core/src/classification/classifier.types.ts`
- Modify: `packages/core/src/classification/classifier.helpers.ts`
- Modify: `packages/core/src/classification/action-registry.types.ts`
- Modify: `packages/core/src/workflow/snapshot.ts`
- Modify: `packages/core/src/workflow/context.ts`
- Modify: `packages/core/src/workflow/segments.ts`
- Modify: `packages/core/src/workflow/snapshot.test.ts`
- Modify: `packages/core/src/workflow/segments.test.ts`
- Modify: `packages/core/src/runtime/evidence.ts`
- Modify: `packages/core/src/interop/openinference.ts`
- Delete: `packages/core/src/domain/` directory (now redundant facade)
- Delete: `packages/core/src/domain.ts` (now redundant facade)

- [ ] **Step 1: Add `@monitor/domain` to `packages/core/package.json` dependencies**

Edit `packages/core/package.json`:

```json
"dependencies": {
  "@monitor/domain": "*",
  "yaml": "^2.0.0",
  "zod": "^3.0.0"
}
```

- [ ] **Step 2: Replace `packages/core/src/monitoring.ts` with re-export from domain**

New file content:
```ts
export * from "@monitor/domain";
```

- [ ] **Step 3: Delete `packages/core/src/domain/` and `packages/core/src/domain.ts`**

Run:
```bash
git rm -r packages/core/src/domain packages/core/src/domain.ts
```

- [ ] **Step 4: Update `packages/core/src/index.ts` to re-export domain**

New file content:
```ts
import { registerDefaultRuntimeAdapters } from "./runtime.js";
export * from "@monitor/domain";
export * from "./classification.js";
export * from "./interop.js";
export * from "./paths.js";
export * from "./runtime.js";
export * from "./workflow.js";

// Auto-register built-in adapters so consumers don't need an explicit init call.
registerDefaultRuntimeAdapters();

/**
 * Re-installs the built-in runtime adapter registry entries.
 * Calling this is optional — adapters are registered automatically on import.
 */
export function initializeDefaultAdapters(): void {
    registerDefaultRuntimeAdapters();
}
```

Note: `./monitoring.js` is no longer re-exported from `index.ts` because `@monitor/domain` supersedes it.

- [ ] **Step 5: Rewrite relative monitoring/shared imports in remaining core files**

For each file listed below, replace `"../monitoring/ids.js"`, `"../monitoring/types.js"`, `"../monitoring/utils.js"`, `"../shared/string-brands.js"` imports with imports from `@monitor/domain`.

Files and exact edits:

**`packages/core/src/classification/classifier.ts`** (line 4):
- Before: `import { defaultLaneForEventKind } from "../monitoring/utils.js";`
- After: `import { defaultLaneForEventKind } from "@monitor/domain";`

**`packages/core/src/classification/classifier.types.ts`** (line 1):
- Before: `import type { MonitoringEventKind, TimelineLane } from "../monitoring/types.js";`
- After: `import type { MonitoringEventKind, TimelineLane } from "@monitor/domain";`

**`packages/core/src/classification/classifier.helpers.ts`** (line 1):
- Before: `import type { MonitoringEventKind, TimelineLane } from "../monitoring/types.js";`
- After: `import type { MonitoringEventKind, TimelineLane } from "@monitor/domain";`

**`packages/core/src/classification/action-registry.types.ts`** (line 1):
- Before: `import type { TimelineLane } from "../monitoring/types.js";`
- After: `import type { TimelineLane } from "@monitor/domain";`

**`packages/core/src/workflow/snapshot.ts`** (line 1):
- Before: `import type { TimelineEvent } from "../monitoring/types.js";`
- After: `import type { TimelineEvent } from "@monitor/domain";`

**`packages/core/src/workflow/context.ts`** (line 1):
- Before: `import type { TimelineEvent } from "../monitoring/types.js";`
- After: `import type { TimelineEvent } from "@monitor/domain";`

**`packages/core/src/workflow/segments.ts`** (line 1):
- Before: `import type { TimelineEvent } from "../monitoring/types.js";`
- After: `import type { TimelineEvent } from "@monitor/domain";`

**`packages/core/src/workflow/snapshot.test.ts`** (lines 3–4):
- Before:
  ```ts
  import type { TimelineEvent } from "../monitoring/types.js";
  import { EventId, TaskId } from "../monitoring/ids.js";
  ```
- After:
  ```ts
  import type { TimelineEvent } from "@monitor/domain";
  import { EventId, TaskId } from "@monitor/domain";
  ```

**`packages/core/src/workflow/segments.test.ts`** (lines 3–4):
- Same edit as `snapshot.test.ts`.

**`packages/core/src/runtime/evidence.ts`** (line 1):
- Before: `import type { TimelineEvent } from "../monitoring/types.js";`
- After: `import type { TimelineEvent } from "@monitor/domain";`

**`packages/core/src/interop/openinference.ts`** (lines 1–2):
- Before:
  ```ts
  import type { EventId, RuntimeSource, TaskId } from "../monitoring/ids.js";
  import type { MonitoringTask, TimelineEvent } from "../monitoring/types.js";
  ```
- After:
  ```ts
  import type { EventId, RuntimeSource, TaskId } from "@monitor/domain";
  import type { MonitoringTask, TimelineEvent } from "@monitor/domain";
  ```

- [ ] **Step 6: Grep for any remaining stale imports**

Run:
```bash
grep -rn '"\.\./monitoring/\(ids\|types\|utils\)' packages/core/src/ || true
grep -rn '"\.\./shared/string-brands' packages/core/src/ || true
```

Expected: no output. If any remain, update them to `@monitor/domain`.

- [ ] **Step 7: Delete now-empty `packages/core/src/shared/` and `packages/core/src/monitoring/` directories**

Run:
```bash
rmdir packages/core/src/shared packages/core/src/monitoring packages/core/src/paths 2>/dev/null || true
# paths/ only removed if empty — paths.ts root facade remains pointing elsewhere; verify before removing.
ls packages/core/src/paths/ 2>&1 | head
```

If `packages/core/src/paths/` still has files (it shouldn't after Task 8), leave the directory alone. If empty and the facade `paths.ts` is the only thing still referencing it, update:

`packages/core/src/paths.ts`:
- Before: `export * from "./paths/utils.js";`
- After: `export * from "@monitor/domain";`

Then `rmdir packages/core/src/paths/`.

- [ ] **Step 8: Do NOT commit yet.**

---

## Task 11: Register `@monitor/domain` in `tsconfig.base.json`

**Files:**
- Modify: `tsconfig.base.json`

- [ ] **Step 1: Add the path mapping**

In `tsconfig.base.json` `compilerOptions.paths`, add:

```json
"@monitor/domain": [
  "packages/domain/src/index.ts"
]
```

Full `paths` block after edit:
```json
"paths": {
  "@monitor/core": [
    "packages/core/src/index.ts"
  ],
  "@monitor/domain": [
    "packages/domain/src/index.ts"
  ],
  "@monitor/server": [
    "packages/server/src/index.ts"
  ],
  "@monitor/mcp": [
    "packages/mcp/src/index.ts"
  ],
  "@monitor/web": [
    "packages/web/src/main.tsx"
  ],
  "@monitor/web-domain": [
    "packages/web-domain/src/index.ts"
  ],
  "@monitor/web-io": [
    "packages/web-io/src/index.ts"
  ],
  "@monitor/web-state": [
    "packages/web-state/src/index.ts"
  ]
}
```

- [ ] **Step 2: Run fresh install to wire workspace link**

Run:
```bash
npm install
```

Expected: `node_modules/@monitor/domain` still present; `node_modules/@monitor/core`'s `package.json` now lists `@monitor/domain` in deps.

- [ ] **Step 3: Do NOT commit yet.**

---

## Task 12: Verify full build and tests pass

**Files:**
- (no edits — verification only)

- [ ] **Step 1: Full build**

Run:
```bash
npm run build
```

Expected: every workspace builds without errors. If any fail:
- For `@monitor/domain`: check barrel + sibling imports.
- For `@monitor/core`: check all rewrites in Task 10 Step 5 applied correctly.
- For downstream (`@monitor/server`, `@monitor/web*`): they should still resolve via `@monitor/core` which now transitively re-exports `@monitor/domain`. No changes required.

- [ ] **Step 2: Lint**

Run:
```bash
npm run lint
```

Expected: passes. Common failure: ESLint flags stale imports missed in Step 5 — fix and re-run.

- [ ] **Step 3: Test**

Run:
```bash
npm test
```

Expected: all vitest suites green. Specific pre-existing tests to watch:
- `packages/core/test/core.test.ts`
- `packages/core/src/workflow/snapshot.test.ts`
- `packages/core/src/workflow/segments.test.ts`

If tests fail because an import used `@monitor/core` for a type now owned by domain, it should still resolve because `@monitor/core` re-exports from `@monitor/domain` (verify `packages/core/src/index.ts` from Task 10 Step 4).

- [ ] **Step 4: Dependency-cruiser check**

Run:
```bash
npm run lint:deps
```

Expected: warnings only, no errors. `domain-is-pure` should emit **zero violations** — confirm in output.

- [ ] **Step 5: Regenerate dependency graph**

Run:
```bash
npm run depgraph
```

Expected: `docs/deps.svg` regenerated showing `domain` as a new node with no inbound arrows except from `core` (and test files).

If `dot` is not installed locally, skip; CI regenerates in its own step (add if desired).

---

## Task 13: Promote `domain-is-pure` to error in dep-cruiser config

**Files:**
- Modify: `.dependency-cruiser.cjs`

- [ ] **Step 1: Change severity**

In `.dependency-cruiser.cjs`, find the `domain-is-pure` rule and change:
```js
severity: "warn",
```
to
```js
severity: "error",
```

- [ ] **Step 2: Verify it still passes**

Run:
```bash
npm run lint:deps
```

Expected: still exits 0 (no new errors because domain was already pure).

---

## Task 14: Commit Phase 1 changes

- [ ] **Step 1: Review staged changes**

Run:
```bash
git status
git diff --stat
```

Expected staged set:
- `packages/domain/*` (new)
- `packages/core/src/*` (modified + deletions)
- `packages/core/package.json` (modified)
- `tsconfig.base.json` (modified)
- `.dependency-cruiser.cjs` (modified)
- `package-lock.json` (modified)

- [ ] **Step 2: Create the commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Carve @monitor/domain out of @monitor/core (hexagonal Phase 1)

Extracts pure types, branded IDs, wire schemas, and utility functions
into a new @monitor/domain package. @monitor/core retains its public
API by re-exporting from @monitor/domain, so downstream packages
(server, mcp, web-*, hook-plugin) continue to work unchanged.

- packages/domain/: new package with shared/, monitoring/, classification/ids+types,
  workflow/ids+types, paths/utils
- packages/core/src/: remaining logic (classification/classifier.*, workflow/snapshot.*,
  runtime/*, interop/*) now imports from @monitor/domain
- .dependency-cruiser.cjs: domain-is-pure rule promoted to error

Spec: docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Verify final state**

Run:
```bash
npm run build && npm run lint && npm run lint:deps && npm test
```

Expected: all four exit 0.

---

# Acceptance Criteria

Phase 0 + Phase 1 are complete when:

- [ ] `docs/ARCHITECTURE.md` exists and describes the target graph
- [ ] `dependency-cruiser` is installed at root; `.dependency-cruiser.cjs` has 6 rules
- [ ] `npm run lint:deps` exists and is wired into CI
- [ ] `packages/domain/` exists as a workspace with `@monitor/domain` name
- [ ] `packages/domain/src/index.ts` explicitly re-exports from shared, monitoring, classification (ids+types), workflow (ids+types), paths/utils
- [ ] `packages/core/` depends on `@monitor/domain` and its `src/index.ts` re-exports from it
- [ ] No file in `packages/core/src/` imports from `../monitoring/*` or `../shared/*` (all go via `@monitor/domain`)
- [ ] `npm run build`, `npm run lint`, `npm run lint:deps`, `npm test` all green
- [ ] `domain-is-pure` rule is at `severity: "error"` and passes

---

# Rollback

If any task fails and cannot be recovered:

```bash
git reset --hard HEAD~N  # where N is the number of phase-0-or-1 commits
npm install
```

Each task's commit is self-contained so selective revert is feasible: use `git log --oneline` to find the exact commit and `git revert <sha>`.

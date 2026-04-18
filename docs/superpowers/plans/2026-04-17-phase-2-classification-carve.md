# Phase 2: Carve `@monitor/classification` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the pure classification logic (classifier + action registry) out of `@monitor/core` into a new `@monitor/classification` package whose only `@monitor/*` dependency is `@monitor/domain`. `@monitor/core` continues to re-export classification symbols so no downstream import path changes.

**Architecture:** `packages/classification/` sits between `domain` and `application/core` in the inner ring. The `.claude/plugin/hooks/classification/` directory remains in place until Phase 6.

**Tech Stack:** TypeScript 5, npm workspaces, `dependency-cruiser`, `vitest`.

**Spec:** `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md` (Phase 2)

**Prerequisite:** Phase 0 + Phase 1 complete on this branch.

---

## File Structure

### New files
- `packages/classification/package.json` — `@monitor/classification@0.1.0`
- `packages/classification/tsconfig.json`
- `packages/classification/tsconfig.test.json`
- `packages/classification/vitest.config.ts`
- `packages/classification/src/index.ts` — explicit barrel
- `packages/classification/src/action-registry.ts` (moved)
- `packages/classification/src/action-registry.constants.ts` (moved)
- `packages/classification/src/action-registry.types.ts` (moved)
- `packages/classification/src/classifier.ts` (moved)
- `packages/classification/src/classifier.helpers.ts` (moved)
- `packages/classification/src/classifier.types.ts` (moved)

### Modified files
- `package.json` (root) — no change needed (workspace glob already covers packages/*)
- `tsconfig.base.json` — add `@monitor/classification` path mapping
- `.dependency-cruiser.cjs` — add `classification-depends-on-domain-only` rule
- `packages/core/package.json` — add `@monitor/classification` as dependency
- `packages/core/src/classification.ts` — re-export from `@monitor/classification`
- `docs/ARCHITECTURE.md` — update current phase note

### Deleted files
- `packages/core/src/classification/index.ts` (redundant — file-level barrel superseded by new package)
- `packages/core/src/classification/` directory (empty after move)

---

## Task 1: Scaffold `packages/classification/`

**Files:**
- Create: `packages/classification/package.json`
- Create: `packages/classification/tsconfig.json`
- Create: `packages/classification/tsconfig.test.json`
- Create: `packages/classification/vitest.config.ts`
- Create: `packages/classification/src/index.ts` (empty placeholder)

- [ ] **Step 1: Create `packages/classification/package.json`**

```json
{
  "name": "@monitor/classification",
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
    "@monitor/domain": "*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/classification/tsconfig.json`**

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

- [ ] **Step 3: Create `packages/classification/tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "test"]
}
```

- [ ] **Step 4: Create `packages/classification/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

- [ ] **Step 5: Create placeholder `packages/classification/src/index.ts`**

```ts
// Intentionally empty placeholder — populated by Task 2.
export {};
```

- [ ] **Step 6: Install workspace**

```bash
npm install
```

Expected: `node_modules/@monitor/classification` symlink appears.

- [ ] **Step 7: Verify scaffold builds**

```bash
npm run build --workspace @monitor/classification
```

Expected: build succeeds, produces `packages/classification/dist/index.js`.

---

## Task 2: Move classification sources and write the barrel

**Files:**
- Move: `packages/core/src/classification/action-registry.ts` → `packages/classification/src/action-registry.ts`
- Move: `packages/core/src/classification/action-registry.constants.ts` → `packages/classification/src/action-registry.constants.ts`
- Move: `packages/core/src/classification/action-registry.types.ts` → `packages/classification/src/action-registry.types.ts`
- Move: `packages/core/src/classification/classifier.ts` → `packages/classification/src/classifier.ts`
- Move: `packages/core/src/classification/classifier.helpers.ts` → `packages/classification/src/classifier.helpers.ts`
- Move: `packages/core/src/classification/classifier.types.ts` → `packages/classification/src/classifier.types.ts`
- Delete: `packages/core/src/classification/index.ts`

- [ ] **Step 1: Move files via `git mv`**

```bash
git mv packages/core/src/classification/action-registry.ts            packages/classification/src/action-registry.ts
git mv packages/core/src/classification/action-registry.constants.ts  packages/classification/src/action-registry.constants.ts
git mv packages/core/src/classification/action-registry.types.ts      packages/classification/src/action-registry.types.ts
git mv packages/core/src/classification/classifier.ts                 packages/classification/src/classifier.ts
git mv packages/core/src/classification/classifier.helpers.ts         packages/classification/src/classifier.helpers.ts
git mv packages/core/src/classification/classifier.types.ts           packages/classification/src/classifier.types.ts
git rm  packages/core/src/classification/index.ts
```

- [ ] **Step 2: Write the explicit barrel `packages/classification/src/index.ts`**

Replace the placeholder with:

```ts
// Action registry (public function + rule types)
export * from "./action-registry.js";
export type { ActionPrefixRule, ActionKeywordRule } from "./action-registry.types.js";

// Classifier (public function + input type)
export * from "./classifier.js";
```

Rationale: `action-registry.constants.ts` is an internal implementation detail — only the classifier itself needs its values. `classifier.helpers.ts`'s `getCanonicalLane` is called only by `classifier.ts`, so it stays internal too. This keeps the public surface small (matches the Phase 1 explicit-barrel convention).

- [ ] **Step 3: Verify imports inside moved files still resolve**

All moved files already use `@monitor/domain` (post-Phase 1 cleanup). Sibling relative imports (`./action-registry.js`, `./classifier.types.js`, etc.) continue to resolve within the new package.

- [ ] **Step 4: Build the new package**

```bash
npm run build --workspace @monitor/classification
```

Expected: clean build. If a sibling import fails to resolve, fix the path (likely a stale `./action-registry.js` vs `./action-registry.constants.js` confusion).

---

## Task 3: Wire `@monitor/core` to the new package

**Files:**
- Modify: `packages/core/package.json`
- Modify: `packages/core/src/classification.ts`

- [ ] **Step 1: Add dependency to `packages/core/package.json`**

Before:
```json
"dependencies": {
  "@monitor/domain": "*",
  "yaml": "^2.0.0",
  "zod": "^3.0.0"
}
```

After:
```json
"dependencies": {
  "@monitor/classification": "*",
  "@monitor/domain": "*",
  "yaml": "^2.0.0",
  "zod": "^3.0.0"
}
```

- [ ] **Step 2: Rewrite `packages/core/src/classification.ts`**

Before:
```ts
export * from "./classification/action-registry.js";
export * from "./classification/classifier.js";
```

After:
```ts
export * from "@monitor/classification";
```

- [ ] **Step 3: Remove the now-empty classification directory**

```bash
rmdir packages/core/src/classification
```

(If the directory is not empty due to something unexpected, stop and investigate before deleting.)

- [ ] **Step 4: Re-run workspace install to refresh symlinks**

```bash
npm install
```

---

## Task 4: Register path mapping and dep-cruiser rule

**Files:**
- Modify: `tsconfig.base.json`
- Modify: `.dependency-cruiser.cjs`

- [ ] **Step 1: Add `@monitor/classification` to `tsconfig.base.json`**

In `compilerOptions.paths`, insert alongside the existing `@monitor/domain` entry:

```json
"@monitor/classification": [
  "packages/classification/src/index.ts"
],
```

- [ ] **Step 2: Add `classification-depends-on-domain-only` rule to `.dependency-cruiser.cjs`**

Insert after the `domain-is-pure` rule, **initially as `warn`**:

```js
{
  name: "classification-depends-on-domain-only",
  severity: "warn",
  comment: "@monitor/classification may only depend on @monitor/domain.",
  from: { path: "^packages/classification/" },
  to:   { path: "^packages/(?!(domain|classification)/)" },
},
```

Rationale for starting at `warn`: follow the Phase 1 pattern — observe zero violations first, then escalate to `error` in Task 7.

---

## Task 5: Verify full build, lint, test, and lint:deps

**Files:** (verification only)

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: all workspaces succeed. If `@monitor/core` fails, check:
- `packages/core/src/classification.ts` re-export path
- `packages/core/package.json` dep entry
- No lingering `./classification/*.js` imports inside `packages/core/src/`

- [ ] **Step 2: Grep for stale internal imports in core**

```bash
grep -rn '"\./classification/' packages/core/src/ || true
```

Expected: no output.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

- [ ] **Step 4: Test**

```bash
npm test
```

Expected suites of note:
- `packages/core/test/core.test.ts` — uses `classifyEvent`, `tokenizeActionName` from `@monitor/core`; must pass through the re-export chain.
- `packages/core/test/rules-index.test.ts` — same surface.
- `packages/server/test/application/monitor-service.test.ts` — imports from `@monitor/core`; unchanged behaviour expected.

- [ ] **Step 5: dependency-cruiser validation**

```bash
npm run lint:deps
```

Expected: exits 0. `classification-depends-on-domain-only` should have **zero violations** (classification sources only import `@monitor/domain` and node/zod runtime). `domain-is-pure` should still show zero violations.

---

## Task 6: Promote rule to error and update ARCHITECTURE.md

**Files:**
- Modify: `.dependency-cruiser.cjs`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Promote severity**

In `.dependency-cruiser.cjs`, change the `classification-depends-on-domain-only` rule:
```js
severity: "warn",
```
to
```js
severity: "error",
```

- [ ] **Step 2: Re-run `npm run lint:deps`**

Expected: still exits 0.

- [ ] **Step 3: Update `docs/ARCHITECTURE.md` current phase note**

Replace the "Current phase notes" section with:

```markdown
## Current phase notes

- `@monitor/domain` and `@monitor/classification` exist; `@monitor/core` re-exports from both.
- `domain-is-pure` and `classification-depends-on-domain-only` are enforced as errors.
- Remaining rules stay in warning-mode until Phase 9 lock.
- New code should import from `@monitor/domain` / `@monitor/classification` directly when possible. Existing imports via `@monitor/core` remain functional.
```

Also update the header line:
```markdown
> Current migration phase: **Phase 2 (classification carve-out complete)**
```

---

## Task 7: Commit

- [ ] **Step 1: Review staged changes**

```bash
git status
git diff --stat
```

Expected staged set:
- `packages/classification/*` (new)
- `packages/core/src/classification/` (deleted files)
- `packages/core/src/classification.ts` (modified)
- `packages/core/package.json` (modified)
- `tsconfig.base.json` (modified)
- `.dependency-cruiser.cjs` (modified)
- `docs/ARCHITECTURE.md` (modified)
- `package-lock.json` (modified)

- [ ] **Step 2: Create the commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Carve @monitor/classification out of @monitor/core (hexagonal Phase 2)

Extracts the pure classifier and action registry into a new
@monitor/classification package whose only @monitor/* dependency
is @monitor/domain. @monitor/core re-exports the classification
barrel, so downstream consumers (server, mcp, web-*) keep working
unchanged.

- packages/classification/: new package with classifier + action-registry
- packages/core/src/classification.ts: re-export of @monitor/classification
- .dependency-cruiser.cjs: classification-depends-on-domain-only rule (error)
- docs/ARCHITECTURE.md: phase note updated

Spec: docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md

Co-Authored-By: Claude Opus 4 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: Verify final state**

```bash
npm run build && npm run lint && npm run lint:deps && npm test
```

Expected: all four exit 0.

---

# Acceptance Criteria

- [ ] `packages/classification/` exists as workspace `@monitor/classification`, depends only on `@monitor/domain`.
- [ ] `packages/classification/src/index.ts` explicitly re-exports the classifier + action-registry public API.
- [ ] `packages/core/src/classification.ts` re-exports from `@monitor/classification`, and `packages/core/src/classification/` is gone.
- [ ] `@monitor/classification` path mapping in `tsconfig.base.json`.
- [ ] `classification-depends-on-domain-only` rule is at `severity: "error"` and passes.
- [ ] `npm run build`, `npm run lint`, `npm run lint:deps`, `npm test` all green.
- [ ] `docs/ARCHITECTURE.md` current-phase note reflects Phase 2 completion.

---

# Rollback

If any task fails and cannot be recovered:

```bash
git reset --hard HEAD~1  # only the single Phase 2 commit
npm install
```

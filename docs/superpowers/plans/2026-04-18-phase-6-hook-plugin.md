# Phase 6 — Hook plugin formalization

**Branch:** `refactor/hexagonal-phase-0-1`
**Spec:** `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md` §Phase 6

## Goal

Move the Claude Code hook plugin from `.claude/plugin/` to `packages/hook-plugin/`, strip
its client-side classification, delete per-session file-system caches, and lock the
`hook-plugin-wire-only` dependency rule so the plugin can only see
`@monitor/domain` wire schemas.

## Architectural decisions

1. **`.claude/plugin/` becomes a symlink, not a deletion.** Claude Code resolves
   `${CLAUDE_PLUGIN_ROOT}` from the directory it discovers. `.claude/plugin/` is the
   conventional discovery path for repo-local plugins. Replacing the directory with
   a relative symlink (`.claude/plugin → ../packages/hook-plugin`) keeps Claude Code
   runtime hooks functional without any client-side configuration change, and the
   spec explicitly endorses this (`".claude/plugin/ becomes build output
   (copied/linked from packages/hook-plugin/)"`). Git tracks symlinks natively.
2. **Client-side classification is fully removed, not gated.** Phase 5d already runs
   `classifyEvent()` inside `EventIngestionService` with "explicit caller input wins"
   semantics. Leaving pre-classified fields on the wire would mean phase-6 plugin
   versions *silently override* the server classifier whenever the plugin's heuristics
   diverge from the server's. Removing the client pipeline makes the server the
   single source of truth.
3. **Transcript cursor stays on disk.** The spec keeps `per-session transcript cursor`
   as legitimate local state because Claude's transcript JSONL grows append-only and
   cursor persistence is the only way to resume tailing across hook invocations. Only
   `*-metadata.json`, `*.json` session-cache, and `.session-history.json` go away.
4. **No session-cache fallback.** Since each hook spawns a fresh tsx process, deleting
   the session cache means every hook calls `/api/runtime-session-ensure` once. That
   endpoint is idempotent by design (Phase 3's `EnsureRuntimeSessionUseCase`). We
   accept the extra HTTP call per hook — the server handles dedupe, and network
   round-trips to localhost are cheap relative to hook startup cost.
5. **`/api/runtime-session-history` query endpoint is out of scope.** Spec §5.2
   promises the endpoint "moves to" server-side. But no current consumer (web, mcp,
   or external) reads `.session-history.json`. The server already persists session
   lifecycle via `session.started` / `session.ended` events (Phase 5d). Adding a
   dedicated read endpoint without a consumer is YAGNI; defer to Phase 9 or when a
   caller materializes. Phase 6 only removes the write-side.
6. **`hook-plugin` package.json declares `@monitor/domain` as a real dep.** Today the
   plugin imports `TimelineLane` and `EventSemanticMetadata` as types from
   `@monitor/core`. Phase 6 retargets those to `@monitor/domain` (where the types
   already live after Phase 1) so the dep-cruiser rule passes. `@monitor/core`
   dependency is removed from the plugin.
7. **Sub-phases are separate commits.** 6a (physical move) → 6b (classification
   strip) → 6c (cache/history strip) → 6d (rule promotion + version bump). Each
   commit must leave CI green and Claude Code hooks functional.

## Sub-phase sequence

### 6a — Relocate plugin to `packages/hook-plugin/`

**Scope:**

- Create `packages/hook-plugin/` via `git mv` of the existing tree. Required sequence
  (order matters — `.claude/plugin` must stop being a directory *before* the symlink
  is created):

  ```bash
  mkdir -p packages/hook-plugin
  git mv .claude/plugin/hooks          packages/hook-plugin/hooks
  git mv .claude/plugin/bin            packages/hook-plugin/bin
  git mv .claude/plugin/.claude-plugin packages/hook-plugin/.claude-plugin
  git mv .claude/plugin/package.json   packages/hook-plugin/package.json
  git mv .claude/plugin/tsconfig.json  packages/hook-plugin/tsconfig.json
  git mv .claude/plugin/DATA_FLOW.md   packages/hook-plugin/DATA_FLOW.md
  git mv .claude/plugin/TRANSCRIPT_SIGNALS_PLAN.md packages/hook-plugin/TRANSCRIPT_SIGNALS_PLAN.md
  rmdir .claude/plugin
  ln -s ../packages/hook-plugin .claude/plugin
  git add .claude/plugin
  ```

  > Note: symlink target is `../packages/hook-plugin` (one `..` — from `.claude/plugin`'s
  > parent `.claude/` up to the repo root, then into `packages/hook-plugin`).

- Update root `package.json` workspaces array (`.claude/plugin` → `packages/hook-plugin`):

  ```json
  "workspaces": [
    "packages/*"
  ]
  ```

  (`.claude/plugin` is no longer a workspace; it's a symlink to one that's already
  matched by `packages/*`.)

- Update `packages/hook-plugin/tsconfig.json` `include` paths so the
  `../../config/load-application-config.d.ts` reference still resolves from the new
  depth (two levels deep under `packages/`, same depth as `.claude/plugin/` was →
  the relative path is identical; verify by running `npm run -w @monitor/claude-plugin lint:types`).

- Update `packages/hook-plugin/package.json` `name` stays `@monitor/claude-plugin`
  (no rename — the package name is public-facing to the Claude Code plugin
  marketplace). Confirm the package.json `name` field remains.

- Run `npm install` at the repo root so the new workspace layout is reflected in
  `package-lock.json`. Expect the lockfile to show `.claude/plugin` dropped and
  `packages/hook-plugin` added, but no other changes.

**Verification:**

- `npm run lint -w @monitor/claude-plugin` → green.
- `npm run lint:deps` → warnings only on the existing non-domain deps (those get fixed
  in 6b/6d).
- `npm test` → green (no plugin tests exist; ensures other workspaces unaffected).
- `ls -la .claude/plugin` → shows symlink to `../packages/hook-plugin`.
- Manually: `.claude/plugin/bin/run-hook.sh --help` resolves through the symlink (if
  there's no `--help` flag, run `cat .claude/plugin/bin/run-hook.sh` to verify it
  reads through the symlink).

**Commit:** `refactor(phase-6a): relocate hook plugin to packages/hook-plugin`

---

### 6b — Strip client-side classification

**Scope:**

- Delete directory `packages/hook-plugin/hooks/classification/` (three files):
  - `command-semantic.ts`
  - `explore-semantic.ts`
  - `file-semantic.ts`

- Remove all classification imports and rewrite the event payload builders to omit
  pre-classified fields. The server applies classification in
  `EventIngestionService.dispatchEvent()`; the plugin only needs to send raw context.

  **Files to modify** (with exact changes):

  | File | Changes |
  |---|---|
  | `packages/hook-plugin/hooks/PostToolUse/Bash.ts` | Remove line 34 import. Drop `semantic` lookup and `buildSemanticMetadata(...)` spread from the `metadata` field. Do **not** set `lane` on the payload — let the server infer it. Keep `command`, `title`, `body`, `toolUseId`. |
  | `packages/hook-plugin/hooks/PostToolUse/File.ts` | Remove imports on lines 34–35. Drop `buildSemanticMetadata(inferFileToolSemantic(...))` from the metadata spread. Keep `toolName`, `title`, `body`, `filePaths` (the server classifier uses `filePaths`). |
  | `packages/hook-plugin/hooks/PostToolUse/Explore.ts` | Remove imports on lines 36–37. Drop `buildSemanticMetadata(semantic)` from metadata. Keep `toolName`, `title`, `body`. |
  | `packages/hook-plugin/hooks/PostToolUse/Mcp.ts` | Remove import on line 32. Drop `buildSemanticMetadata({ ... })`. Keep `mcpServer`, `mcpTool`, `title`, `body`. |
  | `packages/hook-plugin/hooks/PostToolUse/Agent.ts` | Remove import on line 41. Drop both `buildSemanticMetadata({...})` spreads (invocation and completion paths). Keep `agentName`, `skillName`, `title`, `body`. |
  | `packages/hook-plugin/hooks/PostToolUseFailure.ts` | Remove import on line 34. Drop `semanticMetadata` from the Bash-failure payload and `inferCommandSemantic` usage. Keep `toolName`, `command`, `error`, `isInterrupt`, `failed: true`. |

- `packages/hook-plugin/hooks/util/lane.ts` currently re-exports `TimelineLane` and
  defines the `LANE` constant. After this phase, the plugin no longer sets `lane` on
  outbound events — but `LANE` is still referenced for internal categorization
  decisions (e.g., which hook stream a payload belongs to). Audit remaining `LANE.*`
  references after the edits above:

  ```bash
  grep -rn "LANE\." packages/hook-plugin/hooks
  ```

  Any remaining references should be examined case-by-case: if they land on the wire
  payload as `lane`, remove. If they're used only for local control flow (e.g., MCP
  filtering), keep but consider inlining the constant so we can delete `lane.ts`
  entirely in a later cleanup.

- Retarget type imports from `@monitor/core` to `@monitor/domain`:
  - `packages/hook-plugin/hooks/util/lane.ts:17` — `TimelineLane` import.
  - Any remaining `EventSemanticMetadata` import (should be gone after classification
    strip; verify with `grep -rn "@monitor/core" packages/hook-plugin`).

- Update `packages/hook-plugin/package.json` dependencies: add
  `"@monitor/domain": "*"` (or `workspace:*` — match the convention used by other
  packages in this repo), remove any `@monitor/core` dep if present (the current
  package.json shows none — type imports resolve via project references, so this may
  be a no-op beyond adding `@monitor/domain`).

**Verification:**

- `grep -rn "classification/" packages/hook-plugin/hooks` → no matches.
- `grep -rn "buildSemanticMetadata\|inferCommandSemantic\|inferExploreSemantic\|inferFileToolSemantic" packages/hook-plugin` → no matches.
- `grep -rn "@monitor/core" packages/hook-plugin` → no matches.
- `npm run lint -w @monitor/claude-plugin` → green.
- **Manual smoke test:** run a Bash hook by invoking Claude Code interactively and
  running any shell command. Check server logs that the ingested event has
  `metadata.subtypeKey` populated (now set by the server classifier, not the
  plugin). If subtypeKey is missing or `null`, phase 5d classifier coverage has a
  gap and must be fixed before committing.

**Commit:** `refactor(phase-6b): remove client-side classification from hook plugin`

---

### 6c — Delete session-cache and session-history I/O

**Scope:**

- Delete files:
  - `packages/hook-plugin/hooks/lib/session-cache.ts`
  - `packages/hook-plugin/hooks/lib/session-metadata.ts`
  - `packages/hook-plugin/hooks/lib/session-history.ts`

- Remove call sites. Grep before editing to get the full list:

  ```bash
  grep -rn "session-cache\|session-metadata\|session-history\|appendSessionRecord\|getCachedSessionResult\|cacheSessionResult\|deleteCachedSessionResult" packages/hook-plugin/hooks
  ```

  Expected consumers (from Phase 6 explore report):

  | File | Action |
  |---|---|
  | `packages/hook-plugin/hooks/lib/session.ts` | Rewrite `ensureRuntimeSessionForPayload()` to always call `/api/runtime-session-ensure` without consulting/writing the cache. The use case is idempotent. |
  | `packages/hook-plugin/hooks/lib/subagent-session.ts` | Same treatment for the subagent variant: always re-ensure, no `sub--<agentId>.json` cache read/write. |
  | `packages/hook-plugin/hooks/SessionEnd.ts:38` | Remove `appendSessionRecord(...)` call. Remove the subsequent `deleteCachedSessionResult(...)` cleanup (no cache to clean). Keep the `session.ended` event POST. |
  | `packages/hook-plugin/hooks/util/paths.ts:18` | Delete `SESSION_CACHE_DIR` constant if no other consumer remains. Transcript cursor resolves its own path via `transcript-cursor.ts`; check what directory it uses and make it independent of `SESSION_CACHE_DIR`. |

- `transcript-cursor.ts` currently lives at
  `.session-cache/<sessionId>-transcript-cursor.json` (per Phase 6 explore). Move
  its storage to a cursor-specific directory, e.g. `<PROJECT_DIR>/.claude/.transcript-cursors/<sessionId>.json`,
  so that deleting the concept of `.session-cache/` is clean and there's no
  chance a stale metadata file is mistaken for a cursor. Update the directory
  constant and add a one-time migration fallback that, if the old path exists,
  reads it then unlinks it (so users mid-upgrade don't lose their cursor).

- Add a prominent cleanup note in `packages/hook-plugin/DATA_FLOW.md` (or the
  relevant section) stating: "`.session-cache/` and `~/.claude/.session-history.json`
  are no longer written as of plugin v0.2.0. Safe to delete any existing files."
  Do **not** add auto-deletion logic — users with old plugin versions installed
  elsewhere still write there.

**Verification:**

- `grep -rn "session-cache\|session-metadata\|session-history\|\.session-cache" packages/hook-plugin` →
  no matches outside documentation.
- `grep -rn "\.session-history\.json" packages/hook-plugin` → no matches outside docs.
- `npm run lint -w @monitor/claude-plugin` → green.
- **Manual smoke test:** run `rm -rf .claude/.session-cache ~/.claude/.session-history.json`
  (clean slate), then trigger a Claude Code hook flow (start session → run a command →
  end session). Verify:
  - No new files appear in `.claude/.session-cache/` or `~/.claude/`.
  - A `.claude/.transcript-cursors/<sessionId>.json` file appears (new cursor location).
  - Server logs show `runtime-session-ensure` called once per hook; each responds
    idempotently with the same `runtimeSessionId`.
  - `session.started` and `session.ended` events are captured by the server.

**Commit:** `refactor(phase-6c): drop .session-cache and .session-history plugin writes`

---

### 6d — Promote rule, bump version, docs

**Scope:**

- Promote `hook-plugin-wire-only` in `.dependency-cruiser.cjs` from
  `severity: "warn"` to `severity: "error"`. With 6b complete the rule must now pass.

- Bump `packages/hook-plugin/package.json` version to `0.2.0` (major — wire contract
  change: server now mandatory for classification; plugin does not write
  filesystem caches).

- Update `.claude/plugin/.claude-plugin/plugin.json` version to match if it carries
  one (`.claude/plugin` is a symlink so editing resolves to
  `packages/hook-plugin/.claude-plugin/plugin.json`).

- Update `docs/ARCHITECTURE.md` phase-status table to mark Phase 6 complete.

- Update `docs/wiki/claude-code-plugin-adapter.md` and
  `docs/wiki/runtime-adapters-and-integration.md`: wherever `.claude/plugin/...` paths
  appear, add a line noting the canonical source is `packages/hook-plugin/` and
  `.claude/plugin/` is a symlink. Update any lingering references to
  `.session-history.json` as a live data store — it's gone.

- Regenerate dep graph: `npm run depgraph` (produces `docs/deps.svg`). Commit the
  updated SVG.

**Verification:**

- `npm run lint:deps` → green at **error** severity (no warnings from hook-plugin).
- `npm run lint` → green.
- `npm test` → green.
- `git ls-files .claude/plugin` → shows only the symlink entry, no tracked files
  inside.
- Intentional negative test: temporarily add `import { something } from "@monitor/application";`
  to any `packages/hook-plugin/hooks/**.ts`, run `npm run lint:deps`, confirm
  **exit code 1** with `hook-plugin-wire-only` error. Revert the test edit.

**Commit:** `refactor(phase-6d): lock hook-plugin-wire-only rule, bump to v0.2.0`

---

## Out of scope

- **`/api/runtime-session-history` query endpoint** (spec §5.2). No consumer exists;
  defer to Phase 9 or a future read-side feature.
- **MCP adapter renaming** (Phase 7).
- **Web normalization** (Phase 8).
- **`exports` field lock on hook-plugin** (Phase 9 — final lock across all packages).
- **Tests for the hook plugin.** The spec proposes "golden tests: stdin JSON fixture
  → HTTP call assertion" but no such test harness exists today. Creating it is its
  own scoped effort; Phase 6 keeps the manual smoke-test path from the original
  plugin and defers the harness.

## Risks & rollback

- **Claude Code mis-resolves the symlink.** If `CLAUDE_PLUGIN_ROOT` does not follow
  symlinks on some platforms, hooks break silently during 6a. Rollback: `rm
  .claude/plugin && git mv packages/hook-plugin/* .claude/plugin/` and revert
  workspaces change. Pre-commit smoke test in 6a verification catches this.
- **Server classifier has gaps** the client classifier was masking. Phase 5d is
  marked done but may not cover every `subtypeKey` the plugin computed. 6b's
  verification step is the gate; if the server doesn't produce equivalent
  `metadata.subtypeKey` for Bash/File/Explore/Mcp/Agent events, pause 6b and extend
  the server classifier first.
- **`runtime-session-ensure` is not idempotent in practice.** If calling it per hook
  creates duplicate sessions (rather than dedup to the same `runtimeSessionId`), 6c
  causes session explosion. Verify idempotency before landing 6c — either by reading
  `EnsureRuntimeSessionUseCase` source or by instrumenting a smoke test.

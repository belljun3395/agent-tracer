# Phase 5 — Driving-side adapters + classification relocation

**Branch:** `refactor/hexagonal-phase-0-1`
**Spec:** `docs/superpowers/specs/2026-04-17-package-boundary-redesign-design.md` §Phase 5

## Architectural decisions

1. **Adapter packages own their HTTP framework.** `@monitor/adapter-http-ingest`,
   `@monitor/adapter-http-query`, and `@monitor/adapter-ws` each depend on
   `@nestjs/common` for decorators and `zod` for validation. This is correct
   layering — HTTP adapters encode transport semantics.
2. **Mixed-concern controllers get split.** `bookmark.controller.ts` and
   `evaluation.controller.ts` currently mix reads and writes. Split each into
   `*-write.controller.ts` (5a) and `*-read.controller.ts` (5b).
3. **Schemas stay shared via `adapter-http-ingest`.** The read adapter has few
   schemas of its own; ingest owns the write contract (the `ingestEvents*`
   zod schemas). Read adapter re-uses query-param schemas in-place.
4. **Integration tests stay in server.** `observability-routes.test.ts` hits
   composed controllers through Nest + supertest — it belongs with the
   composition root, not any single adapter. Server's `AppModule` stays the
   integration target.
5. **5d is an application-layer change, no new package.** Insert a
   `classifyEvent()` call at the ingestion edge inside
   `EventIngestionService`, so raw payloads get classified server-side.

## Sub-phase sequence (each a separate commit)

### 5a — `@monitor/adapter-http-ingest` (write routes)

**Scope:**
- New package `packages/adapter-http-ingest/`
- Move (via `git mv`): `ingest.controller.ts`, `event.controller.ts`,
  `lifecycle.controller.ts`; split write methods out of
  `bookmark.controller.ts` + `evaluation.controller.ts` into
  `bookmark-write.controller.ts` + `evaluation-write.controller.ts` at the new
  location.
- Move ingest-only schemas (`schemas.ingest.ts`, `schemas.constants.ts`,
  write-half of `schemas.ts`).
- Update server's `AppModule` to register controllers from the new package.

**Verification:** `npm run lint`, `npm run lint:deps`, `npm test` all green.

### 5b — `@monitor/adapter-http-query` (read routes)

**Scope:**
- New package `packages/adapter-http-query/`
- Move: `admin.controller.ts`, `search.controller.ts`,
  `bookmark-read.controller.ts`, `evaluation-read.controller.ts`.
- Move read-half of `schemas.ts` (query-param schemas).
- Update `AppModule`.

**Verification:** same three gates.

### 5c — `@monitor/adapter-ws` (websocket)

**Scope:**
- New package `packages/adapter-ws/`
- Move `presentation/ws/event-broadcaster.ts`.
- Server's `main.ts` imports broadcaster from the new package.
- Keep the `ws` HTTP-upgrade hook in server (it's composition-root concern).

**Verification:** same three gates.

### 5d — server-side classification

**Scope:**
- Inside `EventIngestionService.dispatchEvent()` (or the nearest point where
  we have the full ingest payload but not yet the use-case DTO), call
  `classifyEvent({ kind, title, body, command, toolName, actionName, filePaths, lane })`.
- If `lane` is absent on the ingest payload, use the classification's inferred
  lane; otherwise honor the caller's explicit lane.
- Thread any additional classification tags / matches into the use-case DTO.
- Backwards compat: legacy plugins that already attach `lane` or
  classification-resolved fields keep working (explicit caller input wins).
- Add an application package dep on `@monitor/classification`; promote
  `application-inner-ring` regex in `.dependency-cruiser.cjs` to allow
  `classification`.

**Verification:** add/update unit test on `EventIngestionService` asserting:
- Raw payload → classifier-inferred lane lands in persisted event.
- Payload with explicit lane → caller's lane preserved.

## Out of scope

- Web normalization (Phase 8).
- MCP renaming (Phase 7).
- Hook plugin formalization (Phase 6).
- Leaky-dist fix (Phase 9).

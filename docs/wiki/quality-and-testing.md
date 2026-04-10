# Quality and Testing

For how to actually run tests, see
[Testing & Development](./testing-and-development.md). This page is the
maintainer view — what the quality system covers well today and where
it still has gaps.

## Scripts

From `package.json` at the repo root:

- `npm run build` — build every workspace
- `npm run lint` — lint every workspace (`typescript-eslint` type-checked)
- `npm test` — run every workspace's test suite
- `npm run dev` — run server + dashboard concurrently
- `npm run docs:dev` / `npm run docs:build` — VitePress site

## What's working well

- Every package ships a test script; `@monitor/core`, `@monitor/server`,
  `@monitor/mcp`, and `@monitor/web` each have real coverage.
- Lint config uses `typescript-eslint` with type-checked rules.
- Rules like `no-floating-promises` and `consistent-type-imports` are on,
  which catches real issues instead of only style.
- Server and web tests exercise real flows — not just unit stubs.

## Gaps worth closing

### Structural rules aren't automated

The current lint setup is syntax + type-safety. It does not yet enforce:

- maximum file size per layer
- no circular imports
- layer boundary enforcement (presentation ↔ application ↔ infrastructure)
- banning type duplication between `@monitor/web` and `@monitor/core`

### Doc update discipline isn't automated

Setup guides have been good for a while, but there's no checklist that
fires when someone adds a new event, a new runtime, or a new UI panel.
Right now that discipline is maintained by convention, not by tooling.

### CI / PR entry criteria aren't documented in-repo

`npm test`, `npm run lint`, and `npm run build` should all pass before
a PR lands. That expectation is known to contributors but isn't
captured in a single file a new contributor can find.

## Suggested quality playbook

1. **Document the PR checklist** — `npm test`, `npm run lint`,
   `npm run build`, plus "update the relevant guide / wiki page".
2. **Add structural guards** — file size ceiling, layer import rules,
   and a web-side import rule forbidding duplicated core types.
3. **Add change-type checklists** — "new event", "new runtime adapter",
   "new UI panel", "schema / route / API change" each deserve their own
   short checklist.
4. **Keep docs and code in lockstep** — guide / wiki updates should be
   part of the PR that adds or changes behaviour, not a follow-up.

## Related

- [Testing & Development](./testing-and-development.md)
- [Server-Side Tests](./server-side-tests.md)
- [Web & Core Tests](./web-and-core-tests.md)

# Quality and Testing

For the command list, see [Testing & Development](./testing-and-development.md).
This page is the maintainer view: what the quality system already covers
well and where it still needs help.

## Scripts

From the repo root:

- `npm run build` - build every workspace
- `npm run lint` - eslint plus type-aware lint rules
- `npm run lint:deps` - dependency-cruiser package-boundary checks
- `npm test` - run every workspace test suite
- `npm run docs:build` - build the VitePress site

## What is working well

- Every shipped package participates in the build/test loop, and the core
  packages (`domain`, `classification`, `application`, `server`,
  `adapter-mcp`, `web-app`) all have real coverage
- The server and dashboard have integration-style tests, not just tiny
  unit tests
- Package boundary rules are enforced with dependency-cruiser, not left
  to convention alone
- The web state split (`web-io`, `web-state`, `web-app`) is testable in
  isolation

## Gaps worth closing

### Docs still drift after architecture changes

The package-boundary redesign landed faster than some wiki pages were
updated. That is exactly the kind of drift this repo should keep out.

### Hook integration tests have real startup cost

The Claude plugin tests spawn hook processes repeatedly. That gives good
coverage, but it also means those tests are more sensitive to timeout
budgets than ordinary unit tests.

### Query invalidation is verified more than incremental updates

The current web tests do a good job around invalidation and derived UI
logic, but there is less coverage around future incremental-update
strategies if the socket path becomes more granular.

## Suggested quality playbook

1. Run `build`, `lint`, `lint:deps`, and `test` before merging
2. Update the relevant guide/wiki page in the same change as the code
3. Treat package-boundary regressions as architectural bugs, not style
   issues
4. Add targeted test timeouts only when the test is intentionally
   integration-heavy

## Related

- [Testing & Development](./testing-and-development.md)
- [Server-side tests](./server-side-tests.md)
- [Web & core tests](./web-and-core-tests.md)

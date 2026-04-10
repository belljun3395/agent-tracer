# Server-Side Tests

Server tests are not just simple unit tests, but cover quite a broad range including
application policy, presentation error handling, SQLite migration,
and runtime integration scenarios.

## Key Test Files

- `packages/server/test/application/monitor-service.test.ts`
- `packages/server/test/application/session-lifecycle-policy.test.ts`
- `packages/server/test/presentation/observability-routes.test.ts`
- `packages/server/test/presentation/assistant-response.test.ts`
- `packages/server/test/infrastructure/sqlite-schema-migrator.test.ts`
- `packages/server/test/claude-plugin.test.ts`
- `packages/server/test/setup-external.test.ts`

## What is Verified

### Application

- task/session lifecycle
- runtime session policy
- workflow/evaluation related service behavior

### Presentation

- HTTP route and error mapping
- assistant response endpoint behavior

### Infrastructure

- SQLite schema migration and compatibility

### Runtime integration

- Claude plugin path
- setup:external artifacts

## Characteristics of This Test Suite

- Contains both internal package unit tests and top-level runtime asset validation.
- Verifies product-level behavior quite directly.
- These are the first tests to check when documentation and actual integration paths diverge.

## Related Documentation

- [Monitor Server](./monitor-server.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [setup:external Automation Script](./setup-external-automation-script.md)

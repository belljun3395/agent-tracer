# Server-Side Tests

server 테스트는 단순 unit test만 있는 것이 아니라,
application policy, presentation error handling, SQLite migration,
runtime integration 시나리오까지 꽤 넓게 다룬다.

## 주요 테스트 파일

- `packages/server/test/application/monitor-service.test.ts`
- `packages/server/test/application/session-lifecycle-policy.test.ts`
- `packages/server/test/presentation/observability-routes.test.ts`
- `packages/server/test/presentation/assistant-response.test.ts`
- `packages/server/test/infrastructure/sqlite-schema-migrator.test.ts`
- `packages/server/test/claude-plugin.test.ts`
- `packages/server/test/setup-external.test.ts`

## 무엇을 검증하나

### Application

- task/session lifecycle
- runtime session policy
- workflow/evaluation 관련 service 동작

### Presentation

- HTTP route와 에러 매핑
- assistant response endpoint 동작

### Infrastructure

- SQLite schema migration과 호환성

### Runtime integration

- Claude plugin path
- setup:external 결과물

## 이 테스트 묶음의 특징

- package 내부 단위 테스트와 top-level runtime asset 검증이 같이 있다.
- 제품 수준 동작을 꽤 직접적으로 검증한다.
- 문서와 실제 통합 경로가 어긋날 때 가장 먼저 확인해야 하는 테스트들이다.

## 관련 문서

- [Monitor Server](./monitor-server.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [setup:external Automation Script](./setup-external-automation-script.md)

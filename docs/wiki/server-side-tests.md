# Server-Side Tests

서버 테스트는 application, presentation, integration 성격이 섞여 있다.

## 핵심 파일

- `packages/server/test/application/monitor-service.test.ts`
- `packages/server/test/presentation/create-app.test.ts`
- `packages/server/test/claude-hooks.test.ts`
- `packages/server/test/opencode-monitor-plugin.test.ts`

## 강점

- 주요 lifecycle과 integration path를 실제로 검증한다

## 유지보수 메모

- 일부 테스트는 package 경계를 넘어 top-level runtime asset까지 건드린다
- contract test와 package-internal test를 더 명확히 나누면 좋다

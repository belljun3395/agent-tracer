# Web & Core Tests

웹과 코어는 빠른 단위 테스트 비중이 높다.
즉, 복잡한 도메인 계산과 view helper를 먼저 고정하고,
큰 UI 흐름은 상대적으로 적게 검증하는 구조다.

## core 테스트

주요 파일:

- `packages/core/test/core.test.ts`
- `packages/core/test/runtime-capabilities.test.ts`
- `packages/core/test/rules-index.test.ts`

검증 대상:

- domain contract 기본 동작
- runtime capability registry
- rule/action registry 인덱스

## web 테스트

주요 파일:

- `packages/web/src/App.test.ts`
- `packages/web/src/store/useWebSocket.test.ts`
- `packages/web/src/components/TaskList.test.ts`
- `packages/web/src/components/Timeline.follow.test.ts`
- `packages/web/src/lib/timeline.test.ts`
- `packages/web/src/lib/explorationCategory.test.ts`
- `packages/web/src/lib/eventSubtype.test.ts`
- `packages/web/src/lib/insights.test.ts`
- `packages/web/src/lib/realtime.test.ts`
- `packages/web/src/lib/ui/laneTheme.test.ts`

검증 대상:

- timeline follow/viewport 계산
- subtype/lane theme 해석
- insights 파생 계산
- realtime parsing과 refresh logic
- websocket cleanup와 reconnect 보조 로직

## 현재 테스트 전략의 장점

- 순수 함수와 파생 계산은 비교적 빠르게 회귀를 잡을 수 있다.
- runtime capability나 realtime message 같은 계약성 로직을 작게 검증하기 좋다.

## 보강해 볼 만한 지점

- workflow library UI 흐름
- inspector 탭 간 상호작용
- MCP registry contract와 web read-model 연결 경계

## 관련 문서

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Web Dashboard](./web-dashboard.md)
- [Timeline Canvas](./timeline-canvas.md)

# WebSocket Real-Time Broadcasting

Agent Tracer는 서버 변경 사항을 WebSocket으로 브로드캐스트하지만,
웹은 이 payload를 그대로 store에 머지하기보다 필요한 read model을 다시 조회하는 전략을 쓴다.
즉, WebSocket은 "canonical data stream"이라기보다 "갱신 신호"에 가깝다.

## 핵심 파일

- `packages/server/src/presentation/ws/event-broadcaster.ts`
- `packages/server/src/bootstrap/create-monitor-runtime.ts`
- `packages/web/src/store/useWebSocket.ts`
- `packages/web/src/lib/realtime.ts`
- `packages/web/src/store/useMonitorStore.tsx`

## 서버 쪽 동작

`EventBroadcaster`는 `INotificationPublisher` 구현체다.
알림이 들어오면 `{ type, payload }` JSON을 모든 연결된 클라이언트에 보낸다.

연결 직후에는 `create-monitor-runtime.ts`가 아래 snapshot을 먼저 보낸다.

- `stats` (`/api/overview`에서 보는 요약값)
- `tasks` (태스크 목록)

즉, 첫 연결은 snapshot, 이후는 delta notification으로 생각하면 된다.

## 현재 message 종류

웹의 `MonitorRealtimeMessage` 타입 기준으로 현재 다루는 이벤트는 아래와 같다.

- `snapshot`
- `task.started`, `task.completed`, `task.updated`
- `task.deleted`
- `session.started`, `session.ended`
- `event.logged`, `event.updated`
- `bookmark.saved`, `bookmark.deleted`
- `tasks.purged`

최근 코드에서 이 타입이 `lib/realtime.ts`로 명시적으로 올라와,
`useWebSocket()`이 raw string 대신 파싱된 typed message를 콜백으로 넘긴다.

## 웹 쪽 처리 전략

1. `useWebSocket()`이 메시지를 파싱한다.
2. 짧은 debounce 뒤에 `refreshRealtimeMonitorData()`를 호출한다.
3. message type에 따라 overview, selected task detail, bookmark만 부분 갱신한다.

특징:

- bookmark 변경은 `refreshBookmarksOnly()`만 호출한다.
- `event.updated`는 selected task detail만 새로 읽는다.
- `task.deleted`나 `tasks.purged`는 overview만 새로 읽는다.

즉, 예전보다 message type별 refresh 전략이 조금 더 세분화됐다.

## 장점

- 단순하고 안전하다.
- 서버 payload 구조가 바뀌어도 웹이 직접 state patch를 많이 하지 않아도 된다.
- 잘못된 부분 머지보다 전체 read model 재조회에 가까워 디버깅이 쉽다.

## 한계

- 이벤트가 많아질수록 재조회 비용이 커진다.
- WebSocket payload 안에 이미 충분한 정보가 있어도 현재는 많이 활용하지 않는다.
- overview와 selected task detail을 계속 다시 읽는 구조라 네트워크 비용이 누적된다.

## 중기 개선 아이디어

- task list/store에 대한 incremental patch 도입
- selected task timeline의 append/update 경로 분리
- bookmark/evaluation/read model을 message type별로 더 정밀하게 갱신

## 관련 문서

- [Web Dashboard](./web-dashboard.md)
- [Task List & Global State](./task-list-and-global-state.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)

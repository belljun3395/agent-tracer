# API Client & UI Utilities

웹의 API 호출, realtime parsing, search/evaluation helper, 공용 UI 유틸은
별도 utility 레이어로 모여 있다. 이 레이어를 보면 대시보드가 어떤 서버 계약을 기대하는지 빠르게 알 수 있다.

## 핵심 파일

- `packages/web/src/api.ts`
- `packages/web/src/types.ts`
- `packages/web/src/lib/realtime.ts`
- `packages/web/src/store/useWebSocket.ts`
- `packages/web/src/store/useSearch.ts`
- `packages/web/src/store/useEvaluation.ts`
- `packages/web/src/lib/ui/cn.ts`
- `packages/web/src/lib/ui/clipboard.ts`
- `packages/web/src/lib/ui/laneTheme.ts`

## `api.ts`가 제공하는 것

- overview/tasks/task detail 조회
- bookmark CRUD
- search
- task title/status 수정
- event display title 수정
- finished task purge
- task evaluation 저장/조회
- workflow library 목록 조회 (`fetchWorkflowLibrary`)
- WebSocket URL 생성

최근 코드 기준으로 `TaskEvaluationRecord`, `WorkflowSummaryRecord`는
이제 `@monitor/core` 타입을 재사용한다.

## `types.ts`의 역할 변화

예전에는 웹이 `MonitoringTask`, `TimelineEvent` 같은 타입을 자체 정의했지만,
현재는 핵심 계약을 `@monitor/core`에서 import/export하고,
웹 전용 read model이나 search hit 타입만 별도로 둔다.

이건 문서 관점에서도 중요한 변화다. "웹 타입 drift"는 이전보다 줄었고,
이제 남은 차이는 view-model 성격 인터페이스 쪽에 더 가깝다.

## realtime 유틸

`lib/realtime.ts`는 아래를 제공한다.

- `MonitorRealtimeMessage` 타입
- `parseRealtimeMessage()`
- message type별 refresh 전략을 가진 `refreshRealtimeMonitorData()`

`useWebSocket()`은 이 타입을 사용해 raw string 대신 parse된 message를 콜백으로 넘긴다.

## UI 유틸

- `cn()` - class merge helper
- `copyToClipboard()` - handoff/export용 클립보드 유틸
- `getLaneTheme()` - lane 색상/스타일 일관성 유지
- `useTheme()` - 라이트/다크 테마 토글
- `useDragScroll()` - timeline 같은 영역의 drag-scroll 보조

## 관련 문서

- [Web Dashboard](./web-dashboard.md)
- [Task List & Global State](./task-list-and-global-state.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)

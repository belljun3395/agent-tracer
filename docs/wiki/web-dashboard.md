# Web Dashboard

`@monitor/web`는 Agent Tracer의 읽기 경험을 담당하는 React 19 대시보드다.
task list, timeline, inspector, workflow library를 한 화면에 묶고,
WebSocket 신호와 REST read model을 조합해 상태를 갱신한다.

## 핵심 파일

- `packages/web/src/App.tsx`
- `packages/web/src/store/useMonitorStore.tsx`
- `packages/web/src/components/TaskList.tsx`
- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/components/WorkflowLibraryPanel.tsx`
- `packages/web/src/components/TopBar.tsx`

## 주요 화면과 영역

### Task list

왼쪽 사이드바에서 task 목록, 상태, 선택 상태를 보여 준다.

### Timeline canvas

가운데 메인 영역이다. lane별 카드, connector, zoom, follow, observability badge를 다룬다.

### Event inspector

오른쪽 패널에서 event/task를 더 읽기 쉬운 정보로 재구성한다.
`Inspector`, `Flow`, `Health`, `Tags`, `Task`, `Evaluate`, `Compact`, `Files`, `Exploration`
탭이 있다. `Flow`와 `Health`는 `/api/tasks/:taskId/observability` read model을 사용한다.

### TopBar 컴포넌트 상세

TopBar에는 역할이 다른 두 가지 칩 컴포넌트가 공존한다.

| 컴포넌트 | 데이터 소스 | 역할 |
|----------|-------------|------|
| `TopBarMetricChip` | `GET /api/observability/overview` | 전체 세션 기준 글로벌 지표 카드 (Prompt Capture, Linked Tasks, Stale Running, Avg Duration 등) |
| `ObservabilityChip` | 선택된 task의 `ObservabilityBadgeCounts` | 현재 선택 task 기준 per-task 상태 배지 (exploration, planning, implementation 카운트) |

`TopBarMetricChip`은 `overviewObservability` 섹션에서 전역 리스트를 렌더링한다.
`ObservabilityChip`은 선택된 task가 있을 때 `observabilityStats`를 prop으로 받아 해당 task의 lane별 카운트를 표시한다.

### Workflow library

최근 코드 기준으로 TopBar의 `Library` 버튼을 통해 열리는 별도 패널이다.
`GET /api/workflows`를 읽어 저장된 workflow example을 검색하고 선택할 수 있다.

## 데이터 흐름

1. `useMonitorStore`가 overview, tasks, task detail, bookmarks를 관리한다.
2. `useWebSocket`이 typed realtime message를 수신한다.
3. `refreshRealtimeMonitorData()`가 message type에 맞춰 overview/detail/bookmark refresh를 선택한다.
4. `App.tsx`가 파생 인사이트와 선택 상태를 각 컴포넌트에 전달한다.

## 최근 코드 기준 포인트

### workflow library가 1급 UI가 됐다

이제 workflow library는 개념 문서에만 있는 기능이 아니라,
TopBar 버튼과 `WorkflowLibraryPanel`을 통해 바로 접근 가능한 UI다.

### web 타입이 `@monitor/core`로 다시 수렴했다

`packages/web/src/types.ts`는 `MonitoringTask`, `TimelineEvent`, `TaskEvaluation`,
`WorkflowSummary` 같은 핵심 타입을 이제 `@monitor/core`에서 직접 import/export한다.
예전보다 계약 drift 위험이 줄었다.

### realtime 처리도 message-aware 방향으로 진화했다

`useWebSocket()`은 raw string이 아니라 `MonitorRealtimeMessage | null`을 넘기고,
bookmark/event/task 종류에 따라 refresh 전략을 나눈다.

### observability top bar와 inspector 탭이 추가됐다

TopBar는 이제 overview stats만 아니라 prompt capture, trace-linked task 비율,
stale running task, 평균 작업 시간을 카드로 보여 준다.
선택된 task가 바뀌면 `App.tsx`가 `/api/tasks/:taskId/observability`를 따로 읽어
Inspector의 `Flow` / `Health` 탭을 채운다.

## 구조적으로 보는 강점과 한계

강점:

- 제품 경험이 한 앱 안에 잘 통합돼 있다.
- 인사이트 계산이 많아도 사용자 입장에서는 맥락 전환이 적다.

한계:

- `App.tsx`, `Timeline.tsx`, `EventInspector.tsx`, `insights.ts`에 책임이 크다.
- read model 갱신이 여전히 재조회 중심이라 이벤트 수가 많아지면 비용이 커질 수 있다.

## 관련 문서

- [Task List & Global State](./task-list-and-global-state.md)
- [Timeline Canvas](./timeline-canvas.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
- [Frontend Dashboard](./frontend-dashboard.md)

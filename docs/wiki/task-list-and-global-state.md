# Task List & Global State

task selection, bookmark 상태, URL hash sync, overview fetch orchestration은 현재
`useMonitorStore` 중심 전역 상태 계층에서 관리된다. 이 레이어는 단순 reducer가 아니라,
"대시보드 read model 조정자"에 가깝다.

## 핵심 파일

- `packages/web/src/store/useMonitorStore.tsx`
- `packages/web/src/components/TaskList.tsx`
- `packages/web/src/components/TopBar.tsx`
- `packages/web/src/store/useSearch.ts`
- `packages/web/src/store/useWebSocket.ts`

## `useMonitorStore`가 들고 있는 것

- `tasks`, `bookmarks`, `overview`
- `selectedTaskId`, `selectedEventId`, `selectedConnectorKey`
- `selectedRuleId`, `selectedTag`, `showRuleGapsOnly`
- `taskDetail`
- `isConnected`, `status`, `errorMessage`
- task title/status 편집 상태
- `taskDisplayTitleCache`

즉, 목록 상태와 상세 상태, 일부 UI 편집 상태가 한 provider에 같이 들어 있다.

## 주요 액션과 흐름

### 초기 로드

overview, tasks, bookmarks를 불러오고 URL hash의 task ID를 선택 상태에 반영한다.

### task 선택

selected task가 바뀌면 detail을 읽고, timeline/inspector가 이에 따라 다시 계산된다.

### bookmark 갱신

최근 realtime 처리 변경으로 bookmark message는 `refreshBookmarksOnly()`로 따로 갱신된다.
이 덕분에 event/task 갱신과 bookmark 갱신 경로가 조금 더 분리됐다.

### title/status 편집

task title submit과 status change는 store action + API 호출을 통해 처리된다.
`taskDisplayTitleCache`는 표시 제목 파생값을 재계산 없이 유지하는 역할을 한다.

## TopBar와의 연결

TopBar는 단순 헤더가 아니라 아래 기능을 가진다.

- search query 입력
- task-scope search toggle
- zoom slider
- workflow library 열기
- WebSocket 연결 상태 표시

즉, 전역 상태와 UI 제어의 접점이 상당히 크다.

## 현재 구조의 장점

- 대시보드 상태가 한곳에 모여 추적하기 쉽다.
- task selection, hash sync, refresh orchestration이 분산돼 있지 않다.

## 현재 구조의 한계

- reducer, effect, async fetch, hash sync, optimistic UI가 한 provider에 결합돼 있다.
- selection/UI state와 server-state 성격 데이터가 섞여 있다.
- 기능이 더 늘어나면 feature 단위 분해가 필요하다.

## 관련 문서

- [Web Dashboard](./web-dashboard.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)
- [Timeline Canvas](./timeline-canvas.md)

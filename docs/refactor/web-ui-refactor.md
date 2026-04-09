# Web UI 개선 및 기술부채 해소 계획

## Context

`packages/web/`은 AI 코딩 에이전트의 활동을 실시간 모니터링하는 React 19 대시보드다. 현재 단일 대시보드 화면에 사이드바(세션 목록) + 타임라인 + 인스펙터를 모두 렌더링하고 있어서:
- WebSocket 실시간 업데이트마다 전체 화면이 리렌더링됨
- God 컴포넌트들이 존재 (EventInspector 2,828줄, insights.ts 2,279줄, Timeline 1,497줄)
- `useMonitorStore()`가 전체 상태를 반환해서 모든 컴포넌트가 모든 상태 변경에 리렌더링
- "Task"라는 용어를 "Session"으로 변경 필요 (모니터링 도구의 성격에 맞게)

## 현재 구조 분석

### 파일 크기 상위 10개

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `components/EventInspector.tsx` | 2,828 | 이벤트 상세 패널 (4개 탭 모드, 33개 내부 함수) |
| `lib/insights.ts` | 2,279 | 인사이트 유틸리티 (30+ 함수) |
| `components/Timeline.tsx` | 1,497 | 5레인 캔버스 타임라인 |
| `components/TaskList.tsx` | 705 | 사이드바 세션 목록 |
| `pages/TaskWorkspacePage.tsx` | 677 | 상세 분석 페이지 |
| `components/TaskEvaluatePanel.tsx` | 664 | 워크플로우 평가 폼 |
| `store/useMonitorStore.tsx` | 659 | Zustand 중앙 스토어 |
| `lib/timeline.ts` | 693 | 타임라인 레이아웃 알고리즘 |
| `components/WorkflowLibraryPanel.tsx` | 324 | 워크플로우 라이브러리 모달 |
| `components/TaskHandoffPanel.tsx` | 319 | 태스크 핸드오프 UI |

### 현재 라우트

| 경로 | 컴포넌트 | 설명 |
|------|---------|------|
| `/` | Dashboard | 사이드바 + 타임라인 + 인스펙터 (모두 한 화면) |
| `/tasks/:taskId` | TaskWorkspacePage | 상세 분석 탭 |

### 핵심 문제

1. **단일 화면 과부하**: 사이드바, 타임라인, 인스펙터가 동일 DOM 트리에서 렌더링 → WebSocket 메시지마다 전체 리렌더
2. **전체 상태 구독**: `useMonitorStore()`가 모든 상태를 반환 → 어떤 상태든 변경되면 모든 컴포넌트가 리렌더
3. **God 컴포넌트**: EventInspector(2,828줄)에 33개 함수, insights.ts(2,279줄)에 30+ 함수
4. **코드 중복**: `parseConnectorKey`, 커넥터 해석 로직, Timeline 콜백 구성이 2곳에 중복
5. **Prop Drilling**: Dashboard → TimelineContainer → Timeline으로 15+ props 전달

---

## Phase 0: 기반 작업

> 후속 Phase의 전제조건. 셀렉터와 공유 유틸리티를 먼저 정리해야 분해/분리가 깔끔해진다.

### 0.1 Zustand 선택적 셀렉터 추가

**파일:** `store/useMonitorStore.tsx`

현재 `useMonitorStore()`는 전체 상태를 반환 → 모든 상태 변경이 모든 컴포넌트 리렌더링 유발.

추가할 셀렉터 훅:

| 훅 | 반환값 |
|----|--------|
| `useSelectedSessionId()` | `state.selectedTaskId` |
| `useSelectedEventId()` | `state.selectedEventId` |
| `useSessionDetail()` | `state.taskDetail` |
| `useSessionList()` | `state.tasks` |
| `useBookmarks()` | `state.bookmarks` |
| `useConnectionStatus()` | `state.isConnected` |
| `useMonitorDispatch()` | `dispatch` 함수 (안정적 참조) |
| `useMonitorActions()` | 비동기 액션 메서드 |

기존 `useMonitorStore()`는 호환성 심으로 유지, 점진적 마이그레이션.

### 0.2 중복 유틸리티 추출

**새 파일:** `lib/connector.ts`
- `parseConnectorKey()` — `InspectorContainer.tsx:28`과 `TaskWorkspacePage.tsx:58`에 중복
- `resolveSelectedConnector()` — 양쪽에 동일한 35줄 커넥터 해석 로직

**새 파일:** `hooks/useTimelineActions.ts`
- Timeline 콜백 props 구성 로직 — `TimelineContainer.tsx:106-134`와 `TaskWorkspacePage.tsx:536-563`에 중복

---

## Phase 1: God 컴포넌트 분해

### 1.1 `lib/insights.ts` (2,279줄) → 도메인 모듈 분리

순수 유틸리티 함수이므로 가장 안전한 첫 단계. Barrel 재수출(`index.ts`)로 기존 import 경로 유지.

```
lib/insights/
├── index.ts          # 모든 public symbol 재수출 (하위호환)
├── stats.ts          # buildObservabilityStats, buildCompactInsight
├── files.ts          # collectExploredFiles, collectFileActivity, buildExplorationInsight
├── tags.ts           # buildTagInsights, eventHasTag, filterTimelineEvents
├── questions.ts      # buildQuestionGroups
├── todos.ts          # buildTodoGroups
├── rules.ts          # buildRuleCoverage, collectRecentRuleDecisions
├── tasks.ts          # buildTaskExtraction, buildTaskDisplayTitle, buildInspectorEventTitle
├── subagents.ts      # buildSubagentInsight
└── handoff.ts        # buildHandoffPlain/Markdown/XML/SystemPrompt (~700줄)
```

### 1.2 `EventInspector.tsx` (2,828줄) → 탭 패널 + 공유 UI

33개 내부 함수를 역할별로 분리:

```
components/inspector/
├── InspectorCards.tsx        # SectionCard, SectionTitle, KeyValueTable 등 공유 UI
├── ObservabilityWidgets.tsx  # MetricGrid, PhaseBreakdown 등
├── DetailWidgets.tsx         # DetailSection, DetailIds, DetailTags 등
├── InspectorTab.tsx          # "inspector" 탭 (이벤트 상세)
├── OverviewTab.tsx           # "overview" 탭 (관측성 메트릭)
├── EvidenceTab.tsx           # "evidence" 탭 (파일, 태그, 탐색)
├── ActionsTab.tsx            # "actions" 탭 (추출, 핸드오프, 평가)
├── TagExplorerCard.tsx       # 태그 탐색 카드 (~140줄)
├── FileCards.tsx             # 파일 관련 카드들 (~600줄)
├── RuleDecisionCard.tsx      # 규칙 결정 히스토리
└── SubagentCard.tsx          # 서브에이전트 인사이트
```

잔여 `EventInspector.tsx`: 탭 전환 + 메모이즈된 계산 + 탭 패널 렌더링 (~200줄)

### 1.3 `Timeline.tsx` (1,497줄) → 캔버스/헤더/필터/인터랙션

```
components/timeline/
├── TimelineCanvas.tsx          # 코어 캔버스: 레인, 노드, 커넥터 SVG
├── TimelineHeader.tsx          # 타이틀, 편집 폼, 상태 토글, 배지
├── TimelineFilters.tsx         # 레인 토글, 규칙/태그 필터
└── useTimelineInteraction.ts   # 마우스 핸들러, 줌, 스크롤 팔로우
```

잔여 `Timeline.tsx`: 컴포지션 (~150줄)

---

## Phase 2: 멀티 페이지 네비게이션

### 2.1 새 라우트 구조

| 경로 | 페이지 | 설명 |
|------|--------|------|
| `/` | SessionListPage | 세션 목록 + 검색 + 북마크 + 필터 |
| `/sessions/:sessionId` | SessionDetailPage | 타임라인 + 퀵 인스펙터 |
| `/sessions/:sessionId/workspace` | SessionWorkspacePage | 심화 분석 탭 |
| `/library` | WorkflowLibraryPage | 워크플로우 라이브러리 (모달→페이지) |

하위호환 리다이렉트: `/tasks/:taskId` → `/sessions/:sessionId`, `/?task=<id>` → `/sessions/<id>`

### 2.2 SessionListPage

**새 파일:** `pages/SessionListPage.tsx`

사이드바의 `TaskList`를 전체 페이지로 승격:
- 검색 바 (TopBar에서 이동)
- 세션 카드: 상태 배지, 런타임 소스, 북마크 표시
- 상태/런타임 소스별 필터링
- 승인 큐 (모달에서 인라인으로)

구독: `useSessionList()`, `useBookmarks()`, `useConnectionStatus()`만 → 타임라인/인스펙터와 렌더링 분리

### 2.3 SessionDetailPage

**새 파일:** `pages/SessionDetailPage.tsx`

타임라인(중앙) + 퀵 인스펙터(우측). `useSessionDetail()`과 `useSelectedEventId()`만 구독.

핵심 이점: 사이드바 없음 → WebSocket의 `refreshOverview`(세션 목록, 통계, 북마크 fetch)가 이 페이지를 리렌더링하지 않음. `refreshTaskDetail`만 영향을 미치며, 기존 `mergeTaskDetail` 로직이 참조 안정성을 제공.

### 2.4 공유 레이아웃 셸

**새 파일:** `components/AppShell.tsx`

- TopBar (연결 표시, 네비게이션 링크)
- `<Outlet />` (페이지 콘텐츠)

### 2.5 App.tsx 업데이트

라우트 재구성 + 리다이렉트 추가.

---

## Phase 3: 네이밍 리팩터 (task → session)

> Phase 1-2 완료 후 실행 — 구조 분할 전에 하면 모든 새 파일이 충돌 영역이 됨.

### 범위 규칙

| 영역 | 변경 여부 | 이유 |
|------|----------|------|
| API 레이어 (`api.ts`) | 변경 없음 | 서버 엔드포인트 `/api/tasks/:taskId` 유지 |
| `@monitor/core` 타입 | 변경 없음 | `MonitoringTask` 등 도메인 타입 유지 |
| Store 내부 필드명 | "task" 유지 | API 타입과 매핑. 세션 지향 alias 추가 |
| 컴포넌트 UI 텍스트 | "Task" → "Session" | 사용자에게 보이는 모든 텍스트 |
| 파일명 | 변경 | `TaskList→SessionList`, `TaskEvaluatePanel→SessionEvaluatePanel` 등 |
| 라우트 파라미터 | 변경 | Phase 2에서 이미 `/sessions/:sessionId`로 변경 |

---

## Phase 4: 리렌더링 최적화

### 4.1 WebSocket을 Store 레벨로 이동

현재 `Dashboard`와 `TaskWorkspacePage`에서 각각 `useWebSocket` 호출 → 2개 연결 가능.
`MonitorProvider` 내부에서 단일 WebSocket 관리로 변경.

### 4.2 상태 업데이트 배치화

현재 `refreshOverview`가 4개 dispatch를 순차 호출 → 4번 리렌더.

```typescript
// Before: 4번 리렌더
dispatch({ type: "SET_OVERVIEW", overview });
dispatch({ type: "SET_TASKS", tasks });
dispatch({ type: "SET_BOOKMARKS", bookmarks });
dispatch({ type: "SET_STATUS", status: "ready" });

// After: 1번 리렌더
set((slice) => ({
  state: { ...slice.state, overview, tasks, bookmarks, status: "ready" }
}));
```

### 4.3 React.memo 적용

Phase 1 분할 후 좁은 props를 받는 컴포넌트에 적용:
- `TimelineCanvas` (캔버스 렌더링 비용 높음)
- 각 인스펙터 탭 패널
- 세션 목록 아이템

---

## Phase 5: Prop Drilling 제거

### 5.1 컨테이너 컴포넌트 제거

`TimelineContainer.tsx`, `InspectorContainer.tsx`, `SidebarContainer.tsx`는 store↔presentational 브릿지 역할만 함. 프레젠테이션 컴포넌트가 셀렉터 훅을 직접 사용하면 불필요 → 삭제.

### 5.2 Timeline/Inspector 직접 Store 접근

- `TimelineHeader` → `useSessionTitleEditing()` 셀렉터 직접 사용
- `TimelineFilters` → `useSessionFilters()` 셀렉터 직접 사용
- 각 인스펙터 탭 → 필요한 셀렉터만 구독

---

## 실행 순서 및 의존성

```
Phase 0 (기반)
  0.1 셀렉터 추가
  0.2 중복 유틸 추출
       │
       ▼
Phase 1 (God 컴포넌트 분해)
  1.1 insights.ts 분리 (가장 안전)
  1.2 EventInspector.tsx 분리
  1.3 Timeline.tsx 분리
       │
       ▼
Phase 2 (멀티 페이지)
  2.1-2.5 새 라우트 + 페이지
       │
       ▼
Phase 3 (네이밍 task→session)
  파일명 + UI 텍스트 + 라우트
       │
       ▼
Phase 4 (리렌더링 최적화)
  4.1 WebSocket store 통합
  4.2 상태 배치화
  4.3 React.memo
       │
       ▼
Phase 5 (Prop Drilling 제거)
  컨테이너 컴포넌트 제거 + 직접 접근
```

---

## 리스크 및 대응

| 리스크 | 대응 |
|--------|------|
| insights.ts barrel 재수출 누락 | `tsc --noEmit`으로 즉시 감지 |
| EventInspector 분리 시 클로저 변수 공유 깨짐 | 탭별 로컬 useState로 전환 |
| Timeline 캔버스 렌더링 회귀 | 인터랙션 훅 먼저 추출, 캔버스는 `lib/timeline.ts` 로직 유지 |
| 라우트 변경으로 브라우저 히스토리/북마크 깨짐 | 리다이렉트 라우트 추가 |
| 네이밍 리팩터 병합 충돌 | Phase 1-2 완료 후 실행 |

---

## 검증 방법

각 Phase 완료 후:
1. `npm run build` — 빌드 성공 확인
2. `npm run test` — 기존 테스트 통과
3. `npm run dev:web` — 브라우저에서 수동 확인:
   - 세션 목록 로드 및 선택
   - 타임라인 렌더링 및 이벤트 선택
   - 인스펙터 탭 전환
   - 실시간 WebSocket 업데이트 반영
   - 검색 기능
   - 워크플로우 라이브러리 접근
4. React DevTools Profiler로 리렌더링 범위 확인 (Phase 4 이후)

---

## 주요 수정 파일

| 파일 | Phase | 변경 |
|------|-------|------|
| `store/useMonitorStore.tsx` | 0.1, 4.2 | 셀렉터 추가, 배치 업데이트 |
| `lib/insights.ts` | 1.1 | 9개 모듈로 분리 |
| `components/EventInspector.tsx` | 1.2 | ~15개 파일로 분리 |
| `components/Timeline.tsx` | 1.3 | 4개 파일로 분리 |
| `App.tsx` | 2.5 | 라우트 재구성 |
| `components/TaskList.tsx` | 2.2, 3 | 페이지 승격 + 리네이밍 |
| `pages/TaskWorkspacePage.tsx` | 2.4, 3 | 리팩터 + 리네이밍 |
| `store/useWebSocket.ts` | 4.1 | Store 통합 |
| `components/*Container.tsx` | 5.1 | 삭제 |

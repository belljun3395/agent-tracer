# Blackbox Redesign: `packages/web` + `web-core` + `web-store`

## Context

현재 세 패키지는 실시간 에이전트 추적 UI라는 동일한 목표를 향해 있지만, 경계가 블러됐고 상태 동기화 버그가 반복되고 있다. 최근 commit 4개(`9305bc3`, `3ee36f4`, `0d4ad5b`, `b47d206`) 모두 URL ↔ Store ↔ Component 3-way sync, Suspense stale fiber, 브라우저 환경 가정 실패를 땜빵으로 막은 것이다. 근본 원인은 아키텍처 층위에 있다.

이 문서는 "기존 코드를 블랙박스로 보고, 처음부터 다시 만든다면" 관점의 그린필드 풀-리라이트 계획이다. 우선순위: **(1) 상태 동기화 안정성, (2) 컴포넌트 비대화 해소, (3) 패키지 경계 명확화**.

---

## 1. 현재의 핵심 문제 (Evidence)

| 영역 | 증거 | 근본 원인 |
|---|---|---|
| **상태 동기화** | `hasAutoSyncedTaskRef`, `routeTaskId !== taskId` 가드, `window.location.pathname` 가드, 이중 sync effect | URL·Store·Component 셋 다 mutable source of truth처럼 취급됨 |
| **WebSocket/storage 가정** | `useWebSocket.ts`, `App.tsx`, `TaskWorkspacePage.tsx`에 뒤늦게 try/catch 도배 | 브라우저 환경 실패를 타입으로 표현하지 않음 |
| **비대 컴포넌트** | Timeline.tsx 1,112 / EventInspector.tsx 681 / TaskWorkspacePage.tsx 474 / TaskList.tsx 469 | 레이아웃 계산·상태·렌더링·핸들러가 한 파일에 공존 |
| **비대 유틸** | web-core/lib/insights.ts **1,869줄**, 55개 export, 한국어 문구 포함 | 집계·텍스트 정규화·핸드오프·평가 프롬프트가 혼재 |
| **Props drilling** | EventInspector 18+ props | 도메인 상태가 상위에서 내려감, 컴포지션 부재 |
| **패키지 경계 위반** | web-core/lib/taskWorkspace.ts가 `useCallback/useEffect/useState` 사용 → 타이틀만 "core" | `core` = framework-free 규칙이 깨짐 |
| **상태 혼재** | TaskState 47 필드 (server + UI + loading + cache) | single reducer가 모든 관심사 처리 |
| **레이스 컨디션** | 제목 편집 중 task.updated WebSocket → last-write-wins | optimistic update·version 없음 |
| **taskDisplayTitleCache** | O(n) prune scan, 주기적 갱신 | derived state를 store에 저장 |

---

## 2. Blackbox 설계 원칙

1. **각 상태 조각은 정확히 하나의 source of truth를 가진다.**
   - 라우팅·선택은 URL 전용. Store는 URL을 읽을 수 없다(반대만 가능).
   - 서버 데이터는 TanStack Query 캐시 전용. Zustand에 복제 금지.
   - 영속 UI 환경설정은 `safe-storage` 어댑터 한 곳만 사용.
2. **Package는 의존 방향으로 정의한다.** 상위는 하위를 import하지만 역방향 금지. 계층 위반 시 ESLint로 차단.
3. **프레임워크 의존은 타입 선언으로 명시한다.** `core`는 순수 TS, `store`는 React만, `web`은 React + Router + DOM.
4. **크기 상한:** 컴포넌트 ≤300줄, 유틸 ≤400줄, 함수 ≤50줄. 초과 시 분할.
5. **실패 가능한 경계는 타입으로 표현한다.** WebSocket/Storage는 `Result<T, E>` 반환, 컴포넌트는 상태를 보고 분기.
6. **서버 상태는 서버만 알게 둔다.** Optimistic update + `updatedAt` 기반 충돌 감지, 레이스에 강한 mutation.

---

## 3. 목표 패키지 구조

```
packages/
├── core/            (기존 @monitor/core 유지, 도메인 타입/ID/코어 로직)
├── web-domain/      ← [NEW] 순수 도메인 함수 (no React, no DOM)
├── web-io/          ← [NEW] HTTP + WebSocket + Storage 어댑터
├── web-state/       ← [RENAME web-store] React 상태 hooks (TanStack Query + Zustand)
└── web/             (React UI — feature-sliced)
```

### 의존 방향 (엄격)

```
web  →  web-state  →  web-io  →  web-domain  →  core
                                   ↑
                                   └─ 외부 브라우저 API 경계
```

- `eslint-plugin-boundaries`로 강제. `web-domain`은 `react`/`zustand`/`fetch` import 금지.
- `web-io`는 DOM API(WebSocket, localStorage, fetch) 사용 허용, React 금지.

### 패키지별 책임

**`web-domain`** — 현재 `web-core` 중 순수 부분만
- `types/` — 현재 web-core/types.ts 유지
- `timeline/` — 좌표 계산(`buildTimelineLayout`), 관계(`buildTimelineConnectors`)
- `insights/` — insights.ts를 **7개 파일로 쪼갬**:
  - `aggregation.ts` (통계)
  - `extraction.ts` (작업 제목 추론)
  - `handoff.ts` (4가지 포맷 + 전략 패턴)
  - `evaluation.ts` (평가 프롬프트)
  - `grouping.ts` (질문/TODO 그룹화)
  - `verification.ts` (파일 탐사 검증)
  - `text.ts` (정규화 helpers)
- `subtype/` — eventSubtype 분류
- `observability/` — 포맷팅
- i18n 분리: 한국어 문구는 `web-domain/i18n/ko.ts`로 이동, 함수는 `(strings) => string` 계약

**`web-io`** — 현재 web-core/api.ts + realtime.ts + WebSocket 래퍼
- `http.ts` — fetch 래퍼, 타임아웃, `Result<T, HttpError>` 반환
- `websocket.ts` — WebSocket 생성 실패/재연결/debounce/unmount race를 **한 클래스에 캡슐화** (`MonitorSocket`)
- `realtime.ts` — WS 메시지 parsing + typed event bus (dispatcher 패턴 X, EventTarget 래퍼)
- `storage.ts` — `safeStorage.get(key, schema, fallback)` / `safeStorage.set(key, value)` 단일 진입점. 내부적으로 try/catch.
- `endpoints/` — 도메인별 API 함수 (tasks, bookmarks, search, evaluation, rules)

**`web-state`** — 현재 web-store
- `server/` — TanStack Query hooks (`useTasksQuery`, `useTaskDetailQuery`, `useBookmarksQuery`, `useEvaluationQuery`). 모든 서버 상태의 유일한 저장소.
- `ui/` — Zustand store, **ephemeral UI 상태만** (30 필드 이하):
  - `useSelectionStore` — selectedTaskId, selectedEventId, selectedConnectorKey, selectedRuleId, selectedTag
  - `useInspectorStore` — inspectorWidth, isCollapsed, activeTab-hint
  - `useEditStore` — 제목 편집 draft (server submit는 mutation)
- `realtime/` — `useMonitorSocket(onInvalidate)` — WS 메시지 → TanStack Query invalidation으로 변환하는 단일 hook
- `mutations/` — optimistic update + rollback (제목, 상태 변경, 북마크)
- **제거:** `taskDisplayTitleCache`, `nowMs`, `buildComposedState`, 3-store facade

**`web`** — feature-sliced
```
web/src/
├── app/                        (App.tsx, providers, router)
│   ├── providers/
│   │   ├── QueryProvider.tsx
│   │   ├── SocketProvider.tsx
│   │   └── ThemeProvider.tsx
│   └── router.tsx              (route config only)
├── routes/                     (route components ≤100줄)
│   ├── dashboard/DashboardRoute.tsx
│   ├── task/TaskRoute.tsx
│   └── knowledge/KnowledgeRoute.tsx
├── features/                   (feature-sliced)
│   ├── task-list/
│   ├── timeline/               (Timeline 1,112줄을 12+ 파일로)
│   │   ├── TimelineCanvas.tsx  (SVG render only)
│   │   ├── TimelineLanes.tsx
│   │   ├── TimelineNode.tsx
│   │   ├── TimelineConnector.tsx
│   │   ├── TimelineAxis.tsx
│   │   ├── useTimelineLayout.ts
│   │   ├── useTimelineZoom.ts
│   │   ├── useTimelineSelection.ts
│   │   └── ...
│   ├── inspector/              (EventInspector 681줄 쪼갬)
│   │   ├── InspectorShell.tsx  (layout, tab routing)
│   │   ├── tabs/
│   │   │   ├── OverviewTab/
│   │   │   ├── EvidenceTab/
│   │   │   ├── ActionsTab/
│   │   │   └── InspectorTab/
│   │   └── context/InspectorContext.tsx  (props drilling 제거)
│   ├── task-workspace/
│   ├── knowledge-base/
│   ├── approval-queue/
│   ├── handoff/
│   └── evaluation/
├── widgets/                    (cross-feature composite)
│   ├── TopBar/
│   └── ZoomControl/
├── shared/
│   ├── ui/                     (Button, Badge, Input, SurfaceCard, Tabs)
│   ├── hooks/                  (useMediaQuery, useLocalUrlState)
│   ├── lib/
│   │   ├── cn.ts
│   │   └── urlState.ts         (URL helpers, 아래 참조)
│   └── styles/
```

---

## 4. 상태 관리 전략 (핵심)

### 4.1 각 상태 조각의 소유자

| 상태 | 소유자 | 저장 위치 |
|---|---|---|
| 현재 route (taskId, tab) | URL | React Router |
| 선택 (task/event/connector/rule) | URL (or fallback UI store) | `useSearchParams` via typed helper |
| 서버 데이터 (tasks, bookmarks, detail) | 서버 | TanStack Query cache |
| UI preference (zoom, width, reviewerId) | 브라우저 | localStorage via `safeStorage` |
| ephemeral UI (editing draft, inspector collapse) | React | Zustand `ui` store |
| WS connectivity | React | Zustand `socket` slice (isConnected, lastMessageAt) |

### 4.2 URL이 single source of truth

Typed URL state helper (`shared/lib/urlState.ts`):

```ts
// 개념 스케치
const taskParam = urlParam('task', { schema: TaskId.optional() });
const tabParam  = urlParam('tab',  { schema: PanelTab.optional() });

function useSelectedTaskId(): [TaskId | null, (id: TaskId | null) => void] { ... }
```

- Store에서 URL을 back-write 하는 effect **완전 제거**. (현재 `hasAutoSyncedTaskRef`가 필요한 근본 원인.)
- 컴포넌트는 URL에서 읽고, 사용자 액션은 `navigate()`로 URL 변경. Store는 URL을 읽기만 함.
- 결과: `DashboardRoute`의 이중 sync effect 사라짐. Stale Suspense fiber 문제도 소멸(effect가 없으니 재실행 대상 없음).

### 4.3 서버 상태는 TanStack Query 전용

- Query key: `['task', taskId]`, `['tasks']`, `['bookmarks', taskId]` 등.
- WS 메시지 수신 → `queryClient.invalidateQueries` 또는 `setQueryData` 호출 (낙관적 패치).
- 옵션: `staleTime: 30_000`, `refetchOnWindowFocus: true`.
- `taskDetail.title` 편집은 mutation + optimistic update. `updatedAt` 비교로 서버 응답이 더 오래되면 무시.
- 현재의 `SET_TASKS` / `UPSERT_TASK` / `SET_TASK_DETAIL` / `PATCH_TASK_DISPLAY_TITLE_CACHE` 액션 **모두 제거.**

### 4.4 Zustand는 ephemeral UI 전용

- 세 슬라이스(`selection`·`inspector`·`edit`)로 축소, 총 필드 15개 이하.
- `useMonitorStore` facade 제거 (`buildComposedState`가 매 렌더링 새 객체 만드는 문제 소멸).
- 각 컴포넌트가 필요한 슬라이스만 구독 → selector 성능 자연 확보.

### 4.5 WebSocket pipeline

```
MonitorSocket(url)
  ├─ 내부: try/catch 생성, exponential backoff, unmount race handling
  ├─ 내부: 200ms debounce (유지)
  └─ emit('message', RealtimeMessage)
        ↓
useMonitorSocket(queryClient)
  ├─ task.started / task.completed / task.updated → queryClient.invalidateQueries(['task', id])
  ├─ event.logged / event.updated → setQueryData로 timeline에 삽입
  └─ snapshot → invalidateQueries(['tasks'])
```

- 현재 `realtime.ts`의 `refreshRealtimeMonitorData(dispatch, refreshTaskDetail, ...)` 다인수 dispatcher 소멸.
- 메시지 타입별 핸들러가 단일 파일에 표로 정리됨.

---

## 5. 비대 컴포넌트 분해 (targets)

| 기존 | 변경 후 | 전략 |
|---|---|---|
| Timeline.tsx (1,112) | `features/timeline/` 12+ 파일 | Canvas/Lanes/Node/Connector/Axis 분리, 레이아웃 hook 추출, `react-window`로 가상화 |
| EventInspector.tsx (681) | `features/inspector/InspectorShell.tsx` + 4개 탭 디렉터리 | Props 18개 → `InspectorContext` provider, 탭별 파일이 직접 useQuery 호출 |
| TaskWorkspacePage.tsx (474) | `routes/task/TaskRoute.tsx` ≤120줄 + `features/task-workspace/*` | layout만 라우트에, 비즈니스는 feature로 |
| insights.ts (1,869) | `web-domain/insights/` 7개 파일 | aggregation/extraction/handoff/evaluation/grouping/verification/text |
| TaskList.tsx (469) | `features/task-list/` 3-4 파일 | 필터 바, 행, 빈 상태 분리 |

---

## 6. 실패 가능 경계를 타입으로

```ts
// web-io/storage.ts 개념
type SafeStorage = {
  get<T>(key: string, schema: ZodSchema<T>, fallback: T): T;      // 실패 시 fallback
  set(key: string, value: unknown): Result<void, StorageError>;
  remove(key: string): void;
};

// web-io/websocket.ts 개념
class MonitorSocket {
  constructor(url: string);
  on(evt: 'message', h: (m: RealtimeMessage) => void): Unsubscribe;
  on(evt: 'connectionChange', h: (connected: boolean) => void): Unsubscribe;
  close(): void;
  // 내부: 생성 실패 포함 모든 에러를 내부에서 흡수, 상태 이벤트로 emit
}
```

- 컴포넌트/hook은 try/catch 호출 금지. `web-io`가 모든 실패를 상태/결과로 변환.
- 현재 `App.tsx`·`TaskWorkspacePage.tsx`·`ApprovalQueuePanel.tsx`의 try/catch 도배 사라짐. (`ApprovalQueuePanel`이 아직 try/catch 없어 잠재 버그인 상황도 원천 제거.)

---

## 7. 마이그레이션 카트오버 전략 (그린필드지만 점진 투입)

그린필드라도 한 번에 전부 스왑하면 테스트 불가 → **기능 단위 stripe cutover**:

1. **S0 (bootstrap)** — `web-domain`·`web-io`·`web-state` 스캐폴드 생성. eslint boundaries 설정. TanStack Query provider 부착. `safeStorage`·`MonitorSocket` 구현 + 유닛 테스트.
2. **S1 (routes & URL state)** — 새 router + URL helpers 도입. Dashboard/Task/Knowledge route를 빈 껍데기로 구성. 기존 `App.tsx` DashboardRoute의 3-way sync 제거 검증.
3. **S2 (server state)** — Tasks/Bookmarks/Overview/Detail을 TanStack Query로 전환. 기존 Zustand task store 제거. WS → query invalidation 연결.
4. **S3 (timeline feature)** — Timeline 1,112줄을 features/timeline/으로 분해. 가상화 도입.
5. **S4 (inspector feature)** — EventInspector 분해 + InspectorContext. 탭별 자체 데이터 로딩.
6. **S5 (insights domain split)** — insights.ts를 7개 파일로 분해, i18n 분리.
7. **S6 (workspace + remaining features)** — TaskWorkspacePage, ApprovalQueue, Handoff, Evaluation, KnowledgeBase.
8. **S7 (retire)** — `web-core`, `web-store` 삭제. import 경로 일괄 변경.

각 스트라이프 말미에 **viewport 3 (320·768·1440)·테마 2개·스모크 플로우 5개 (대시보드 열기, 태스크 클릭, 탭 전환, WS 메시지 반영, 재접속)** 를 브라우저 QA.

---

## 8. 핵심 생성/수정 파일 (그린필드 기준)

### 새로 만들 디렉터리
- `packages/web-domain/src/` (현재 `web-core`의 pure 부분 이식 + insights 7분할)
- `packages/web-io/src/http.ts, websocket.ts, realtime.ts, storage.ts, endpoints/*.ts`
- `packages/web-state/src/server/*, ui/*, realtime/*, mutations/*`
- `packages/web/src/app/providers/*, routes/*, features/*, widgets/*, shared/*`

### 삭제 대상 (S7)
- `packages/web-core/` 전체
- `packages/web-store/` 전체
- `packages/web/src/pages/` 전체 (routes/로 대체)
- `packages/web/src/components/Timeline.tsx`, `EventInspector.tsx` 등 거대 단일 파일

### 보존·이식
- `packages/web-core/lib/timeline.ts` → `web-domain/timeline/layout.ts` (내용 유지)
- `packages/web-core/lib/eventSubtype.ts` → `web-domain/subtype/` (파일 분리만)
- `packages/web-core/types.ts` → `web-domain/types/`
- UI atoms (`components/ui/*`) → `web/src/shared/ui/` (그대로 이동)
- Tailwind tokens·styles → `web/src/shared/styles/`

---

## 9. 검증 (end-to-end)

### Unit
- `web-domain/*`: 순수 함수 100% 커버. 특히 insights 7분할 각각.
- `web-io/storage`: private-mode·quota-exceeded 시나리오 목.
- `web-io/websocket`: 생성 실패·unmount race·재연결 backoff 시나리오.

### Integration
- `web-state/server/*`: MSW로 API 모킹, query 동작 검증.
- WS → query invalidation 파이프라인 테스트.

### E2E (Playwright)
- 대시보드 → 태스크 선택 → URL 직접 편집으로 `?task=` 제거 → URL 유지되는지(현재 버그 regression guard).
- Task A → Task B 빠른 전환 시 URL이 A로 되돌아가지 않는지(`3ee36f4` regression guard).
- private 모드에서 에러 없이 동작.
- WS 연결 실패 시 앱이 죽지 않고 재연결 시도 표시.
- 제목 편집 중 WS task.updated 수신 시 draft가 날아가지 않는지.
- 테마·viewport 3개·뷰 2개(dashboard/knowledge) 스크린샷.

### Lint guards
- `eslint-plugin-boundaries` — 패키지 간 역방향 import 차단.
- `import/no-cycle` — 순환 금지.
- 파일 길이 룰 — 컴포넌트 300, 유틸 400 초과 시 warn.

### 수동 스모크 체크리스트 (각 스트라이프 종료 시)
- [ ] 대시보드에서 태스크 리스트 로드
- [ ] 태스크 클릭 → URL 변경 + 타임라인 표시
- [ ] 이벤트 클릭 → Inspector 탭 전환 URL 반영
- [ ] Inspector 탭 전환 → URL 유지, 되돌이 버그 없음
- [ ] 북마크 생성/삭제
- [ ] 제목 편집 + WS 메시지 동시 수신 → 데이터 정합
- [ ] WebSocket 재시작 시 UI 정상 (빈 화면 없음)
- [ ] Safari private 모드에서 동작

---

## 10. 리스크 & 트레이드오프

- **React Query 도입 학습 비용**: 팀 전체 Zustand→Query 패턴 전환 필요. 그러나 race/동기화 문제 대부분이 자연 해결되는 편익이 큼.
- **리라이트 크기**: 웹 코드 베이스의 절대 다수를 건드림. 따라서 S0~S7 stripe로 쪼개 각 단계 배포 가능.
- **한국어 i18n 분리의 부수 효과**: 현재 한 곳에 쓰인 문구를 `i18n/ko.ts`로 옮기는 것만으로도 실제 다국어는 해결되지 않음. 초기엔 ko-only 유지하되 API만 미래지향적으로 설계.
- **Timeline 가상화**: SVG 기반이라 `react-window` 적용에 커스텀 구현 필요. 필요 시 S3를 두 단계(분해 → 가상화)로 다시 쪼갤 것.

---

## 11. 한 줄 요약

> URL·서버 캐시·로컬 UI를 **세 개의 독립된 소유자**로 분리하고, WebSocket·Storage 실패를 타입으로 흡수하고, `insights.ts`·`Timeline.tsx`·`EventInspector.tsx`를 **feature-sliced**로 쪼개면 현재 4개 커밋이 반복해서 고치던 버그들은 애초에 존재할 수 없게 된다.

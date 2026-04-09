# Web UI 리팩토링 계획

## 개요

`@monitor/web` 패키지의 거대 컴포넌트 분해, 상태 관리 개선, 네이밍 정리를 단계적으로 수행한다.

### 현재 상태

| 항목 | 현황 |
|------|------|
| 프레임워크 | React 19 + react-router-dom v7 |
| 상태 관리 | Zustand 5 (`useMonitorStore.tsx`) |
| 스타일 | Tailwind CSS 4 (CSS variable 기반) |
| 빌드 | Vite 6 |
| 테스트 | Vitest (`--passWithNoTests`) |
| 거대 컴포넌트 | `EventInspector.tsx` (2,828줄) |
| Core 의존 파일 | 16개 |

---

## Phase 0 — 기반 정비

> **병렬 실행**: Core Phase 1-2와 병렬 가능

### 0.1 라우팅 구조 정리

현재 `react-router-dom` v7을 사용 중이나 라우트 정의가 분산되어 있을 수 있다.
`App.tsx` 또는 진입점에서 라우트 구조를 정리하고, 향후 코드 스플리팅 대비 `lazy()` 적용 가능 구간을 표시한다.

### 0.2 Tailwind 4 테마 체계 정리

현재 CSS variable 기반 테마 (`--border`, `--surface`, `--surface-2`, `--bg`, `--text-3` 등)가
EventInspector에서 인라인으로 사용되고 있다.

공통 변수를 `lib/ui/` 또는 Tailwind config로 통합하고, 다크/라이트 모드 전환 지원을 표준화한다.

---

## Phase 1 — EventInspector 분해 (~10개 컴포넌트)

> **병렬 실행**: Core Phase 1-2와 병렬 가능

### 1.1 현재 구조 분석

`EventInspector.tsx` (2,828줄)는 다음 책임을 한 파일에 담고 있다:
- 이벤트 상세 패널 (Inspector 탭)
- 태스크 개요 (Overview 탭)
- 증거 분석 (Evidence 탭)
- 액션 뷰 (Actions 탭)
- 파일 탐색/활동 통계
- 관찰가능성 지표
- 질문/할일 그룹
- 정렬 로직 (`sortExploredFiles`, `sortFileActivity`)
- CSS 상수 (`cardShell`, `cardHeader`, `cardBody` 등)

### 1.2 분리 대상 (~10개)

| 새 파일 | 원본 위치 | 역할 |
|---------|-----------|------|
| `inspector/EventDetailPanel.tsx` | Inspector 탭 전체 | 개별 이벤트 상세 |
| `inspector/OverviewTab.tsx` | Overview 탭 | 태스크 개요 + 관찰가능성 |
| `inspector/EvidenceTab.tsx` | Evidence 탭 | 증거 분석 뷰 |
| `inspector/ActionsTab.tsx` | Actions 탭 | 액션 뷰 |
| `inspector/SectionCard.tsx` | `SectionCard` 컴포넌트 | 재사용 가능한 카드 래퍼 |
| `inspector/ExploredFilesSection.tsx` | 파일 탐색 섹션 | 탐색된 파일 목록 + 정렬 |
| `inspector/FileActivitySection.tsx` | 파일 활동 섹션 | 읽기/쓰기 활동 통계 |
| `inspector/ObservabilitySection.tsx` | 관찰가능성 섹션 | trace link, action registry 지표 |
| `inspector/QuestionGroupSection.tsx` | 질문 그룹 섹션 | 질문 그룹 렌더링 |
| `inspector/TodoGroupSection.tsx` | 할일 그룹 섹션 | 할일 그룹 렌더링 |

`EventInspector.tsx`는 탭 전환 + 위 컴포넌트 조합만 담당하는 ~200줄 파일이 된다.

### 1.3 재사용 가능한 기존 코드

`lib/insights.ts`의 빌더 함수들은 이미 잘 분리되어 있으므로 그대로 import한다:

- `buildCompactInsight`, `buildExplorationInsight`, `buildInspectorEventTitle`
- `buildMentionedFileVerifications`, `buildObservabilityStats`, `buildRuleCoverage`
- `buildQuestionGroups`, `buildSubagentInsight`, `buildTagInsights`
- `buildTaskExtraction`, `buildTodoGroups`
- `collectRecentRuleDecisions`, `collectExploredFiles`, `collectFileActivity`
- `collectPlanSteps`, `collectViolationDescriptions`, `collectWebLookups`

`lib/observability.ts`의 포맷터들도 그대로 사용:
- `evidenceTone`, `formatEvidenceLevel`, `formatCount`, `formatDuration`, `formatRate`

### 1.4 CSS 상수 추출

`EventInspector.tsx`에 정의된 CSS 상수를 `inspector/styles.ts`로 추출:

```typescript
// components/inspector/styles.ts
export const cardShell = "gap-0 overflow-hidden rounded-[16px] border ...";
export const cardHeader = "flex items-center justify-between ...";
export const cardBody = "px-4 py-4";
export const innerPanel = "rounded-[12px] border ...";
export const monoText = "font-mono text-[0.8rem] leading-6";
```

---

## Phase 2 — 상태 관리 개선

> **병렬 실행**: Core Phase 1-2와 병렬 가능

### 2.1 Zustand Store 리팩토링

`useMonitorStore.tsx`를 기능별 slice로 분리:

- `useTaskStore` — 태스크 목록, 선택 상태
- `useEventStore` — 이벤트 목록, 필터
- `useWebSocketStore` — WebSocket 연결, 실시간 업데이트

### 2.2 상태 배치화

WebSocket으로 대량 이벤트가 들어올 때 렌더링 성능 최적화:

**방안 A: `requestAnimationFrame` 디바운싱**
```typescript
const batchedEvents: TimelineEvent[] = [];
let rafId: number | null = null;

function onWsMessage(event: TimelineEvent) {
  batchedEvents.push(event);
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
      store.setState((s) => ({ events: [...s.events, ...batchedEvents] }));
      batchedEvents.length = 0;
      rafId = null;
    });
  }
}
```

**방안 B: Zustand의 `useSyncExternalStore` 자체 배치 활용**

React 19의 자동 배치가 Zustand 5와 결합되면 대부분의 경우 충분하다.
실측 후 RAF 디바운싱이 필요한 경우에만 방안 A를 적용한다.

### 2.3 테스트 계획

각 Phase에서 추출된 컴포넌트/스토어에 대한 테스트:

| 대상 | 테스트 유형 | 도구 |
|------|------------|------|
| inspector/* 컴포넌트 | 렌더링 + 탭 전환 | vitest + @testing-library/react |
| store slices | 상태 변이 단위 테스트 | vitest |
| WebSocket 배치 | 대량 메시지 처리 성능 | vitest + mock WebSocket |
| EventInspector 통합 | 전체 탭 동작 | vitest + @testing-library/react |

### Phase별 검증 체크리스트

| Phase | 추가 테스트/검증 |
|-------|-----------------|
| Phase 0 | 라우트 접근 시 올바른 컴포넌트 렌더링 확인 |
| Phase 1 | 분리된 각 탭 컴포넌트 렌더링 스모크 테스트 |
| Phase 2 | store slice 단위 테스트 — 각 slice가 올바른 상태 슬라이스만 반환하는지 확인 |
| Phase 3 | UI 텍스트에 "Task"가 남아있지 않은지: `grep -ri "task" packages/web/src/components/ --include="*.tsx"` |

---

## Phase 3 — 네이밍/구조 정리

> **Phase 2 직후 수행**

### 3.1 파일 네이밍 컨벤션

현재 혼재된 네이밍 패턴을 통일:

| 현재 | 변경 후 | 이유 |
|------|---------|------|
| `EventInspector.tsx` | `event-inspector.tsx` | kebab-case 통일 |
| `TaskList.tsx` | `task-list.tsx` | |
| `TopBar.tsx` | `top-bar.tsx` | |
| `useMonitorStore.tsx` | `use-monitor-store.tsx` | |
| `useResizable.ts` | `use-resizable.ts` | |

또는 PascalCase를 React 컨벤션으로 유지하되, hooks/lib/store는 camelCase로 통일.
팀 합의 후 결정.

### 3.2 디렉토리 구조

```
packages/web/src/
  ├── components/
  │   ├── inspector/        # Phase 1에서 분리된 컴포넌트
  │   ├── ui/               # 공통 UI (Badge, Button, PanelCard)
  │   ├── TaskList.tsx
  │   ├── Timeline.tsx
  │   ├── TopBar.tsx
  │   └── ...
  ├── hooks/                # 커스텀 훅
  ├── lib/                  # 유틸리티, 인사이트 빌더
  ├── store/                # Zustand 스토어
  └── types.ts              # 공유 타입 (Core re-export 포함)
```

---

## Core 의존성 주의사항

`@monitor/core`를 import하는 Web 파일 16개:

| 파일 | import 대상 |
|------|------------|
| `types.ts` | 도메인 타입 re-export |
| `api.ts` | API 호출 시 타입 |
| `components/EventInspector.tsx` | `buildReusableTaskSnapshot`, `getEventEvidence` |
| `components/TaskEvaluatePanel.tsx` | 도메인 타입 |
| `components/TaskHandoffPanel.tsx` | 도메인 타입 |
| `components/workflowPreview.ts` | 워크플로우 타입 |
| `store/useEvaluation.ts` | 평가 타입 |
| `store/useMonitorStore.test.ts` | 테스트용 타입 |
| `lib/insights.ts` | 분류 타입, 증거 타입 |
| `lib/insights.test.ts` | 테스트용 타입 |
| `lib/realtime.ts` | 실시간 이벤트 타입 |
| `lib/realtime.test.ts` | 테스트용 타입 |
| `lib/timeline.ts` | 타임라인 타입 |
| `lib/timeline.test.ts` | 테스트용 타입 |
| `lib/eventSubtype.test.ts` | 이벤트 서브타입 |
| `components/Timeline.follow.test.ts` | 테스트용 타입 |

**Core export 변경 시 영향도 확인:**
```bash
grep -r "from \"@monitor/core\"" packages/web/src/ | sort
```

---

## 주요 파일 참조

| 파일 | 역할 | Phase |
|------|------|-------|
| `packages/web/src/components/EventInspector.tsx` | 분해 대상 (2,828줄) | 1 |
| `packages/web/src/lib/insights.ts` | 인사이트 빌더 (재사용) | 1 |
| `packages/web/src/lib/observability.ts` | 포맷터 (재사용) | 1 |
| `packages/web/src/store/useMonitorStore.tsx` | Zustand 스토어 | 2 |
| `packages/web/src/store/useWebSocket.ts` | WebSocket 훅 | 2 |
| `packages/web/src/types.ts` | Core 타입 re-export | 전체 |

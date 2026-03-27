# Agent Thought Flow Improvement Plan

## 현재 구현 상태 (2026-03-27)

이 브랜치에는 다음 read model / UI가 먼저 구현되었다.

- task-level observability API
  - `GET /api/tasks/:taskId/observability`
- global observability overview API
  - `GET /api/observability/overview`
  - `GET /api/overview` 안에도 snapshot 포함
- UI diagnostics surface
  - Top bar diagnostics cards
  - Inspector `Flow` / `Health` tabs
- read model 내용
  - phase breakdown
  - active / waiting duration 추정
  - session resumed/open 상태
  - relation coverage
  - rule gap count
  - work item / goal / plan / handoff focus
  - runtime source summary

즉 이 문서의 최종 비전 전체를 끝낸 것은 아니지만, “event log를 thought-flow 관점으로 읽기 시작하는 첫 제품 레이어”는 들어간 상태다.

## 목적

이 문서는 Agent Tracer를 "이벤트 로그 대시보드"에서 "AI 에이전트의 생각 흐름과 실행 인과를 읽는 도구"로 발전시키기 위한 구체적인 구현 계획이다.

우리가 보고 싶은 핵심은 단순한 시간순 로그가 아니다.

- 어떤 목표가 생겼는가
- 어떤 plan으로 정리되었는가
- 어떤 todo/work item으로 쪼개졌는가
- 누가 그 일을 맡았는가
- 어떤 action/tool/file work가 실제로 기여했는가
- 어떤 verify/rule/result가 그 판단을 닫았는가
- 중간에 plan이 바뀌었는가, handoff가 있었는가

즉, 사용자가 읽고 싶은 것은 `시간순 카드 목록`이 아니라 `목표 -> 계획 -> 실행 -> 검증 -> 결과`의 줄거리다.

## 현재 구현에서 확인된 핵심 문제

### 1. 커넥터가 인과 관계가 아니라 시간순 인접 이벤트만 연결한다

현재 `packages/web/src/lib/timeline.ts`의 `buildTimelineConnectors()`는 정렬된 `items[i] -> items[i + 1]`만 연결한다. 이 방식은 다음 문제를 만든다.

- 실제로는 관련 없는 카드도 원인-결과처럼 보인다.
- `todo -> plan -> action -> verify -> complete` 같은 흐름을 보여주지 못한다.
- 파일 파생 이벤트가 사이에 끼면 사용자가 보고 싶은 "의도 흐름"이 깨진다.

관련 위치:

- `packages/web/src/lib/timeline.ts:242`
- `packages/core/src/domain.ts:107`
- `packages/server/src/application/types.ts:208`

### 2. 데이터 모델에 인과 관계가 1급 개념으로 없다

현재 `TimelineEvent`는 사실상 `taskId`, `sessionId`, `kind`, `lane`, `title`, `body`, `metadata` 정도만 가진다. `todoId`, `questionId`, `sequence` 같은 일부 안정 키는 있지만, 아래 관계를 구조적으로 표현하지 못한다.

- 이 action이 어떤 todo를 수행한 것인지
- 이 verification이 어떤 plan/action의 결과인지
- 이 handoff가 어떤 work item을 넘긴 것인지
- 이 derived user message가 정확히 어떤 raw event를 가리키는지

그 결과 UI는 `metadata`를 해석해 추론하거나, 결국 시간순 연결에 의존하게 된다.

관련 위치:

- `packages/core/src/domain.ts:107`
- `packages/core/src/domain.ts:175`
- `packages/server/src/application/types.ts:79`
- `packages/server/src/application/types.ts:105`
- `packages/server/src/application/types.ts:138`
- `packages/server/src/presentation/schemas.ts:119`

### 3. 커넥터 상세 보기 기능이 사실상 끊겨 있다

현재 앱은 `selectedConnectorKey` 상태를 관리하지만, `EventInspector`에는 항상 `selectedConnector={null}`이 전달된다. `Timeline` 안의 SVG 커넥터도 클릭 동작이 연결되지 않았다.

즉, "어떤 카드가 어떤 카드와 왜 연결되어 있는지"를 사용자가 직접 확인할 수 없다.

관련 위치:

- `packages/web/src/App.tsx:503`
- `packages/web/src/App.tsx:522`
- `packages/web/src/components/Timeline.tsx:578`
- `packages/web/src/components/Timeline.tsx:591`
- `packages/web/src/styles.css:1358`
- `packages/web/src/styles.css:1395`

### 4. todo/question은 상태 전이만 보이고 실행 경로는 보이지 않는다

현재 `buildTodoGroups()`와 `buildQuestionGroups()`는 같은 ID의 이벤트를 묶어 상태 전이만 보여준다. 이것은 useful하지만, "생각 흐름"을 보여주기에는 부족하다.

예를 들어 `todo`는 현재 이렇게만 보인다.

- added
- in_progress
- completed

하지만 사용자가 진짜 알고 싶은 것은 이것이다.

- 어떤 plan 변경이 이 todo를 만들었는가
- 어떤 action/tool/file work가 이 todo에 기여했는가
- 어떤 subagent가 맡았는가
- 어떤 verification이 끝을 보증했는가

관련 위치:

- `packages/web/src/lib/insights.ts:935`
- `packages/web/src/lib/insights.ts:1012`
- `packages/web/src/components/EventInspector.tsx:284`
- `packages/web/src/components/EventInspector.tsx:307`

### 5. 멀티에이전트 관찰이 task parent-child 수준에 머물러 있다

현재도 parent-child task와 async lifecycle은 기록되지만, 아래 정보는 부족하다.

- 자식 agent가 어떤 todo/work item을 맡았는가
- 기대 결과가 무엇이었는가
- 어떤 evidence를 반환했는가
- 부모 agent의 판단이 어떻게 바뀌었는가

즉, delegation은 보이지만 "왜 맡겼고 무엇을 가져왔는지"는 잘 안 보인다.

관련 위치:

- `packages/core/src/domain.ts:51`
- `packages/server/src/application/types.ts:10`
- `packages/server/src/application/types.ts:105`
- `packages/web/src/components/TaskList.tsx:198`

### 6. 현재 UI는 저수준 이벤트가 너무 많이 노출된다

실제 화면을 보면 파일 파생 이벤트(`App.tsx`, `styles.css`, `package.json` 등)가 일반 카드처럼 등장한다. 이 이벤트들은 조사에는 도움이 되지만, 기본 흐름에서는 노이즈가 된다.

기본 화면은 "줄거리"를 먼저 보여주고, 파일/도구/저수준 이벤트는 drill-down에서 보여주는 편이 맞다.

관련 위치:

- `packages/server/src/application/monitor-service.ts:1093`
- `packages/web/src/components/Timeline.tsx:631`

### 7. 신뢰성을 깎는 현재 버그/운영 이슈가 있다

- WebSocket effect가 task 변경마다 재연결되고 cleanup에서 소켓을 닫지 않아 연결 누수가 발생한다.
- `session-end`가 `sessionId` 없이 호출되면 최신 세션을 임의로 닫는다.
- `VITE_BADEN_BASE_URL`은 오타로 보이며 배포 override를 깨뜨릴 가능성이 높다.
- 모바일에서 3컬럼 레이아웃이 유지되어 실사용성이 낮다.
- Node 25 환경에서 `better-sqlite3`가 깨져 server test/runtime 신뢰성이 낮다.

관련 위치:

- `packages/web/src/App.tsx:217`
- `packages/server/src/presentation/schemas.ts:133`
- `packages/server/src/application/monitor-service.ts:337`
- `packages/web/src/api.ts:15`
- `packages/web/src/styles.css:147`

## 제품 원칙

개선 방향은 아래 5개 원칙을 따라야 한다.

1. 기본 화면은 "이벤트 나열"이 아니라 "일의 흐름"을 보여준다.
2. 인과 관계는 추론이 아니라 명시적 모델을 우선한다.
3. high-level narrative와 low-level evidence를 분리한다.
4. 멀티에이전트 협업은 delegation/handoff 단위로 읽을 수 있어야 한다.
5. 사용자는 "무슨 일이 있었는가"보다 "왜 그렇게 되었는가"를 빠르게 파악해야 한다.

## 제안하는 목표 상태

최종적으로 사용자가 한 todo/work item을 클릭하면 아래가 보이는 상태를 목표로 한다.

- Goal: 왜 이 일이 생겼는가
- Plan revisions: 어떤 계획 변화가 이 일을 만들거나 바꿨는가
- Assigned agent(s): 누가 맡았는가
- Work done: 어떤 action/tool/file work가 기여했는가
- Checks: 어떤 verify/rule/test가 확인했는가
- Outcome: 완료/실패/보류 여부와 이유
- Why connected: 카드 간 연결의 자연어 설명

그리고 타임라인 커넥터는 다음 의미를 가진다.

- `implements`
- `revises`
- `verifies`
- `answers`
- `delegates`
- `returns`
- `completes`
- `blocks`

## 구현 전략

### Phase 0. 현재 결함 먼저 정리

이 단계는 thought flow 기능을 올리기 전에 반드시 해야 한다.

#### 0-1. WebSocket 누수 제거

- `packages/web/src/App.tsx`의 WebSocket effect를 `selectedTaskId`에 의존하지 않게 바꾼다.
- 선택된 태스크는 ref로 읽거나 message handler 내부에서 최신 값을 참조하도록 변경한다.
- cleanup에서 반드시 현재 socket을 닫는다.

완료 기준:

- task를 여러 번 바꿔도 WebSocket connection 수가 1개로 유지된다.
- 새 이벤트가 와도 refresh가 중복 실행되지 않는다.

#### 0-2. Connector selection을 실제로 동작시키기

- `Timeline.tsx`의 `.connector-hitbox`에 `onClick`을 연결한다.
- `App.tsx`에서 계산한 selected connector를 `EventInspector`에 전달한다.
- connector 선택 시 source/target 카드 highlight와 inspector detail이 함께 보이게 한다.

완료 기준:

- 커넥터 클릭 시 inspector에 source/target/edge type/why connected가 표시된다.

#### 0-3. 운영 안정성 수정

- `VITE_BADEN_BASE_URL`을 `VITE_BACKEND_BASE_URL`로 수정하고, 구 이름은 deprecation fallback으로 잠시 유지한다.
- `session-end`는 `sessionId`를 필수로 바꾸거나, 최소한 ambiguous close를 막는 보호 로직을 추가한다.
- `.nvmrc` 또는 docs에 Node 20/22 LTS를 명시하고 server test를 그 버전에서 돌리게 한다.

### Phase 1. 인과 관계를 1급 모델로 추가

핵심은 `metadata`에 흩어진 단서를 typed relation으로 끌어올리는 것이다.

#### 1-1. Core domain 확장

`packages/core/src/domain.ts`에 아래 타입을 추가한다.

```ts
export type EventEdgeType =
  | "implements"
  | "revises"
  | "verifies"
  | "answers"
  | "delegates"
  | "returns"
  | "completes"
  | "blocks"
  | "caused_by";

export interface EventEdge {
  readonly id: string;
  readonly taskId: string;
  readonly sourceEventId: string;
  readonly targetEventId: string;
  readonly type: EventEdgeType;
  readonly workItemId?: string;
  readonly explanation?: string;
  readonly confidence: "explicit" | "derived";
  readonly createdAt: string;
}
```

그리고 `TimelineEvent`에 최소한 아래 linkage 필드를 추가한다.

```ts
readonly goalId?: string;
readonly planId?: string;
readonly workItemId?: string;
readonly handoffId?: string;
readonly causedByEventId?: string;
readonly outcomeOfEventId?: string;
```

#### 1-2. Server input DTO 확장

`packages/server/src/application/types.ts`의 `TaskPlanInput`, `TaskActionInput`, `TaskVerifyInput`, `TaskTodoInput`, `TaskAsyncLifecycleInput`, `TaskThoughtInput`, `TaskUserMessageInput`에 공통 linkage 필드를 추가한다.

추가 권장 필드:

- `goalId?: string`
- `planId?: string`
- `workItemId?: string`
- `parentEventId?: string`
- `relatedEventIds?: readonly string[]`
- `handoffId?: string`
- `edgeType?: EventEdgeType`
- `explanation?: string`

특히 `TaskUserMessageInput`은 `captureMode="derived"`일 때 `sourceEventId`를 필수로 강제해야 한다.

#### 1-3. DB 설계

권장 스키마는 `timeline_events`와 별도로 `event_edges` 테이블을 두는 방식이다.

```sql
create table if not exists event_edges (
  id text primary key,
  task_id text not null references monitoring_tasks(id) on delete cascade,
  source_event_id text not null references timeline_events(id) on delete cascade,
  target_event_id text not null references timeline_events(id) on delete cascade,
  edge_type text not null,
  work_item_id text,
  explanation text,
  confidence text not null default 'explicit',
  created_at text not null
);

create index if not exists idx_event_edges_task on event_edges(task_id, created_at);
create index if not exists idx_event_edges_source on event_edges(source_event_id);
create index if not exists idx_event_edges_target on event_edges(target_event_id);
```

이 방식이 좋은 이유:

- 이벤트는 append-only로 유지할 수 있다.
- 하나의 이벤트가 여러 관계를 가질 수 있다.
- UI가 커넥터를 event list가 아니라 edge list 기준으로 그릴 수 있다.

### Phase 2. Work Item Trace 읽기 모델 추가

이 단계가 thought flow를 실제로 usable하게 만든다.

#### 2-1. 새로운 read model 정의

`packages/server`에 `WorkItemTrace`를 추가한다.

```ts
export interface WorkItemTrace {
  readonly workItemId: string;
  readonly title: string;
  readonly status: "open" | "in_progress" | "completed" | "cancelled" | "blocked";
  readonly goal?: TimelineEvent;
  readonly plans: readonly TimelineEvent[];
  readonly todos: readonly TimelineEvent[];
  readonly actions: readonly TimelineEvent[];
  readonly verifications: readonly TimelineEvent[];
  readonly outcomes: readonly TimelineEvent[];
  readonly handoffs: readonly TimelineEvent[];
  readonly contributingAgents: readonly {
    readonly agent: string;
    readonly taskId?: string;
    readonly sessionId?: string;
    readonly contributionCount: number;
  }[];
  readonly edges: readonly EventEdge[];
}
```

#### 2-2. aggregation 규칙

최소 규칙은 다음과 같다.

- 같은 `workItemId`를 공유하는 이벤트를 기본 묶음으로 삼는다.
- `todoId`만 있고 `workItemId`가 없는 구버전 이벤트는 migration fallback으로 `workItemId = todoId` 취급한다.
- `parentEventId`, `relatedEventIds`, `event_edges`를 함께 읽어 plan/action/verify/outcome을 연결한다.
- `delegates`/`returns` edge를 통해 subagent contribution을 trace에 붙인다.

#### 2-3. API 추가

새 endpoint를 추가한다.

- `GET /api/tasks/:taskId/work-items`
- `GET /api/tasks/:taskId/work-items/:workItemId`

`/api/tasks/:taskId`에 전부 넣는 대신 별도 endpoint로 두는 이유:

- 기존 타임라인 응답과 분리되어 점진적 도입이 쉽다.
- work item trace는 계산 비용이 더 크다.
- UI에서 on-demand fetch가 가능하다.

### Phase 3. MCP/수동 입력 경로 확장

MCP 경로를 강화하지 않으면 Codex/Cursor 계열 통합에서 핵심 정보가 빠진다.

#### 3-1. MCP tool schema 보강

`packages/mcp/src/index.ts`에서 다음을 반영한다.

- `monitor_task_start`에 `taskKind`, `parentTaskId`, `parentSessionId`, `backgroundTaskId` 지원
- `/api/task-link`를 감싸는 `monitor_task_link` 도구 추가
- semantic event 도구에 linkage 필드 전달 가능하게 확장
- derived `user.message`에서 `sourceEventId` 필수화

#### 3-2. 새 semantic 도구 검토

도입을 권장하는 새 도구:

- `monitor_work_item`
- `monitor_event_edge`
- `monitor_handoff`

반드시 처음부터 3개 다 만들 필요는 없지만, 최소한 `event edge`를 명시적으로 보낼 수 있는 경로는 필요하다.

### Phase 4. UI를 "스토리 읽기" 중심으로 재구성

#### 4-1. 커넥터 렌더링 교체

`buildTimelineConnectors()`를 시간 인접 기반이 아니라 `EventEdge[]` 기반으로 바꾼다.

필수 변경:

- source/target를 edge로부터 계산
- edge type별 색/모양/배지 적용
- `explicit` vs `derived` 시각 구분
- connector hover/click 시 label 노출

예시:

- `implements`: 실선
- `verifies`: 점선 + 체크 아이콘
- `delegates`: 아래 레인으로 내려가는 cyan edge
- `returns`: 위로 올라오는 edge
- `revises`: amber edge

#### 4-2. Todo Journey 패널 추가

`EventInspector`에 새 패널 또는 todo 선택 시 전용 섹션을 추가한다.

구성:

- Goal
- Plan revisions
- Work done
- Checks
- Outcome
- Contributing agents

이 패널은 단순 상태 전이가 아니라 "이 todo가 어떻게 끝났는지"를 보여준다.

#### 4-3. Why connected 패널 추가

커넥터 선택 시 아래 내용을 보여준다.

- Edge type
- Source event
- Target event
- Explanation
- Related work item
- Contributing agent/session

그리고 한 줄 설명을 꼭 넣는다.

예시:

`이 verification은 todo "Add trace edges"를 완료하기 전에 실행된 마지막 체크입니다.`

#### 4-4. low-level event 노출 방식 조정

기본 타임라인에서는 아래 이벤트를 축약 또는 접는다.

- `file.changed`
- 동일 action에 딸린 개별 파일 카드
- 단순 metadata-only 시스템 이벤트

대신 상위 카드 안에 evidence count로 넣는다.

예시:

- `Rebuild native dependency`
  - files 3
  - tools 1
  - checks 0

#### 4-5. 멀티에이전트 시각화 강화

필수 요소:

- 카드에 `agent`, `session`, `subagent`, `work item` 배지
- sidebar에 parent-child 개수만이 아니라 delegated work item count
- inspector에 "delegated by / returned to" 정보
- 필요하면 background lane 안에서도 agent별 grouping 옵션 제공

#### 4-6. responsive 레이아웃 재설계

모바일/좁은 폭에서는 3컬럼 고정 레이아웃을 유지하면 안 된다.

변경 방향:

- `max-width: 1100px`: sidebar collapse 기본값
- `max-width: 860px`: inspector를 drawer/tab으로 전환
- `max-width: 640px`: one-column stack로 전환

### Phase 5. 활용 기능 추가

이 단계는 제품 가치를 크게 올린다.

#### 5-1. 실패 회고용 뷰

`Why did this fail?` 중심으로 재구성된 trace view.

- 마지막 failed verify
- 그 verify로 이어진 actions
- 관련 todo/plan
- 담당 agent
- 빠진 check 또는 missing handoff

#### 5-2. prompt/process 개선용 비교

같은 유형의 work item을 비교해 아래를 본다.

- 어떤 agent가 verify 전에 너무 많은 exploration을 하는가
- 어느 prompt가 plan revision을 많이 유발하는가
- 어떤 delegation pattern이 completion rate가 높은가

이를 위해 나중에는 aggregate analytics가 필요하다.

#### 5-3. 운영자 신뢰 도구

운영자가 빠르게 판단할 수 있어야 한다.

- 지금 이 task는 어디서 막혔는가
- 누가 무엇을 맡고 있는가
- 검증 없이 완료로 넘어간 work item이 있는가
- 질문만 많고 실행이 없는 task가 있는가

## 실제 구현 순서

현실적인 순서는 아래를 권장한다.

### Step 1. 안정화 PR

범위:

- WebSocket leak 수정
- connector click/inspector dead path 수정
- env var 오타 수정
- `session-end` ambiguity 방지
- Node version 가이드 추가

예상 영향 파일:

- `packages/web/src/App.tsx`
- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/styles.css`
- `packages/web/src/api.ts`
- `packages/server/src/presentation/schemas.ts`
- `packages/server/src/application/monitor-service.ts`
- `README.md`

### Step 2. relation model PR

범위:

- `EventEdge` 타입 추가
- server DTO 확장
- DB migration 추가
- edge append/read path 추가
- MCP tool schema 확장

예상 영향 파일:

- `packages/core/src/domain.ts`
- `packages/server/src/application/types.ts`
- `packages/server/src/infrastructure/monitor-database.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/presentation/schemas.ts`
- `packages/server/src/presentation/create-app.ts`
- `packages/mcp/src/index.ts`

### Step 3. work item trace PR

범위:

- `WorkItemTrace` read model
- new API endpoints
- sample/seed/test scenarios 업데이트

예상 영향 파일:

- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/presentation/create-app.ts`
- `packages/server/test/application/monitor-service.test.ts`
- `packages/server/src/seed.ts`

### Step 4. narrative UI PR

범위:

- edge-based connector renderer
- Todo Journey panel
- Why connected panel
- low-level evidence folding
- subagent contribution badges
- responsive layout 개선

예상 영향 파일:

- `packages/web/src/lib/timeline.ts`
- `packages/web/src/lib/insights.ts`
- `packages/web/src/components/Timeline.tsx`
- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/components/TaskList.tsx`
- `packages/web/src/styles.css`
- `packages/web/src/types.ts`
- `packages/web/src/App.tsx`

### Step 5. analytics/use-case PR

범위:

- failed trace summaries
- delegation insights
- repeated pattern comparison

이 단계는 앞의 1-4단계가 안정된 뒤 진행한다.

## 테스트 계획

### 서버 단위 테스트

반드시 추가할 케이스:

- `derived user.message`는 `sourceEventId` 없으면 reject
- action/verify/todo/async 입력에서 edge가 생성되는지
- 하나의 work item trace에 여러 event type이 올바르게 묶이는지
- handoff가 parent-child task와 edge 양쪽에 반영되는지
- ambiguous session end가 차단되는지

### 웹 단위 테스트

반드시 추가할 케이스:

- edge list 기반 connector 렌더링
- connector click -> inspector detail
- todo 선택 -> Todo Journey 패널 렌더링
- low-level file evidence가 기본 view에서 fold되는지
- mobile breakpoint에서 layout collapse가 적용되는지

### Playwright/E2E

최소 시나리오:

1. 단일 todo 완료 흐름
2. todo가 subagent에 delegation되는 흐름
3. question -> answered -> concluded 흐름
4. verify fail 후 plan revise되는 흐름
5. 모바일 viewport에서 sidebar/inspector collapse 확인

## seed data 개선 제안

현재 `packages/server/src/seed.ts`는 단순 데모에는 충분하지만 thought flow 데모로는 약하다. 아래 시나리오를 추가하는 것을 권장한다.

- `todo-1`: added -> in_progress -> completed
- `plan-1`: initial plan -> revised plan
- `handoff-1`: parent agent delegates todo-1 to subagent
- `verify-1`: test failure -> new plan revision -> retry -> pass
- `question-1`: asked -> answered -> concluded

이 데이터가 있어야 UI/Playwright 테스트도 의미 있게 돌아간다.

## 이 도구를 어떻게 활용하면 좋은가

### 1. 에이전트 회고 도구

작업이 끝난 뒤 "무엇을 했는가"가 아니라 "어떻게 판단했는가"를 회고한다.

질문 예시:

- 계획은 언제 왜 바뀌었는가
- 실행 전에 충분한 탐색이 있었는가
- verification 없이 완료 처리된 work item이 있는가
- subagent delegation은 실제로 도움이 되었는가

### 2. 운영 중 디버깅 도구

실시간으로 아래를 본다.

- 지금 막힌 work item은 무엇인가
- 어느 agent가 오래 응답이 없는가
- verify fail 이후 새로운 plan이 생겼는가
- 질문 단계에서 멈춰 있는가, 실행 단계에서 멈춰 있는가

### 3. 프롬프트/프로세스 개선 도구

여러 작업을 모아 비교한다.

- 특정 프롬프트는 plan churn이 많은가
- 어떤 agent는 todo를 잘게 쪼개지만 verify가 약한가
- delegation을 많이 할수록 completion quality가 좋아지는가

## 성공 지표

기능이 잘 구현되었는지 판단하는 기준은 아래로 둔다.

- 사용자가 특정 todo의 완료 경로를 10초 안에 설명할 수 있다.
- connector를 클릭했을 때 "왜 연결되었는지"를 문장으로 이해할 수 있다.
- subagent 작업이 어떤 work item에 기여했는지 수동 추적 없이 보인다.
- low-level evidence를 숨겨도 high-level narrative가 유지된다.
- 모바일에서도 최소한 task 선택, trace 확인, inspector 탐색이 가능하다.

## 최종 제안

우선순위는 아래 순서로 고정하는 것을 권장한다.

1. 현재 버그와 dead path를 먼저 고친다.
2. 인과 관계를 typed model + edge table로 올린다.
3. `WorkItemTrace` 읽기 모델을 만든다.
4. UI를 Todo Journey / Why Connected 중심으로 바꾼다.
5. 이후 analytics와 활용 기능을 확장한다.

핵심은 하나다.

Agent Tracer가 잘 되려면 "무슨 이벤트가 있었는가"보다 "이 일이 왜 이렇게 끝났는가"를 보여줘야 한다.

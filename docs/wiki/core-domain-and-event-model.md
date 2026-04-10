# Core Domain & Event Model

`@monitor/core`는 Agent Tracer 전체의 공통 언어를 정의한다. 이 패키지의 목적은
"서버가 저장하는 것", "MCP가 보내는 것", "웹이 보여주는 것"이 같은 의미 체계를
공유하도록 만드는 것이다.

## 핵심 파일

- `packages/core/src/domain.ts` (barrel export)
- `packages/core/src/domain/types.ts` (branded types 포함: RuntimeAdapterId, SessionIdBrand, etc.)
- `packages/core/src/domain/constants.ts`
- `packages/core/src/domain/utils.ts`
- `packages/core/src/classifier.ts`
- `packages/core/src/action-registry.ts`
- `packages/core/src/event-semantic.ts` (hook-web semantic metadata contract)
- `packages/core/src/runtime-capabilities.ts` (barrel export)
- `packages/core/src/runtime-capabilities.constants.ts`
- `packages/core/src/runtime-capabilities.types.ts`
- `packages/core/src/runtime-capabilities.helpers.ts`
- `packages/core/src/path-utils.ts`

## 이 패키지가 정의하는 것

### 1. Timeline lane

`TimelineLane`은 이벤트를 `user`, `exploration`, `planning`, `implementation`,
`questions`, `todos`, `background`, `coordination`으로 나눈다.
대시보드가 수직 레인 구조를 가질 수 있는 이유가 여기서 시작된다.

### 2. Event kind

`MonitoringEventKind`는 `task.start`, `user.message`, `tool.used`,
`terminal.command`, `verification.logged`, `assistant.response` 같은
canonical event 이름을 정의한다.

### 3. Task, session, timeline event

`MonitoringTask`, `MonitoringSession`, `TimelineEvent`는 서버 저장소와 웹 응답의
기본 shape다. task status, background lineage, classification payload도 이 타입들에 묶여 있다.

### 4. Event Semantic Metadata Contract

`event-semantic.ts` (추가: 2026-04-10)는 hook layer가 생산하고 web UI가 소비하는
의미적 메타데이터의 명시적 계약을 정의한다.

```typescript
export interface EventSemanticMetadata {
  readonly subtypeKey: EventSubtypeKey;  // "read_file", "run_test", "mcp_call", ...
  readonly subtypeGroup: EventSubtypeGroup;  // "files", "execution", "coordination"
  readonly toolFamily: EventToolFamily;  // "explore", "file", "terminal"
  readonly operation: string;            // "search", "modify", "execute", "delegate"
  readonly entityType?: string;          // "file", "directory", "command"
  readonly entityName?: string;          // 구체적 파일명, 커맨드명 등
}
```

이 계약이 코드 레벨에서 명시화되면서, 새 subtype 추가 시 hook과 web이
동시에 업데이트돼야 한다는 요구사항이 타입 체크로 감지된다.

### 5. Branded Types

`domain/types.ts`에서 runtime adapter ID, session ID 등을 nominal type으로 정의해
서버-MCP-web 간 타입 안전성을 높였다 (추가: 2026-04-10).

예시: `RuntimeAdapterId` (string이 아닌 명시적 branded type)

### 6. Runtime capability registry

런타임별 관찰 가능 범위, session close policy, native skill path는
`runtime-capabilities.ts`가 source of truth다.

## 왜 중요한가

새 기능을 추가할 때 실수하기 쉬운 지점은 "서버 route만 늘리고 core 의미 정의를 놓치는 것"이다.
하지만 Agent Tracer는 런타임이 여러 개이기 때문에, 기능을 추가할 때 가장 먼저 정해야 하는 것은
"이 이벤트가 어떤 kind와 lane을 가지는가", "어떤 metadata를 canonical contract로 볼 것인가"다.

즉, 변경 순서는 대체로 아래와 같다.

1. `@monitor/core`에서 이벤트 의미와 타입을 정의한다.
2. server schema/service/repository를 맞춘다.
3. MCP tool registration이나 runtime adapter를 맞춘다.
4. web 표시와 인사이트 계산을 보강한다.

## 현재 모델의 특징

### lane 기본값과 명시적 override가 함께 있다

`defaultLaneForEventKind()`가 event kind별 기본 lane을 제공하지만,
실제 기록 시에는 명시적 lane과 action registry 매치가 이를 보정할 수 있다.

### 관계형 메타데이터를 폭넓게 지원한다

event metadata에는 `parentEventId`, `relatedEventIds`, `planId`, `workItemId`,
`relationType`, `relationLabel` 같은 연결 정보가 들어갈 수 있다.
이 덕분에 timeline connector와 task handoff 요약을 만들 수 있다.

### workflow evaluation도 core의 일부다

`TaskEvaluation`, `WorkflowSummary`, `WorkflowSearchResult`는 단순 UI 타입이 아니라
제품 레벨 기능의 일부이므로 `core`에 위치한다.

## 변경할 때 체크할 것

- 웹이 `packages/web/src/types.ts`에서 재export하는 core 타입과 web 전용 view-model 경계를 헷갈리지 않는지 확인
- MCP input schema와 server request schema가 core contract와 어긋나지 않는지 확인
- slug 생성 규칙이 비 ASCII 제목에서 충분한지 확인
- path normalization이 외부 런타임과 운영체제 차이를 흡수하는지 확인

## 관련 문서

- [Domain Model: Tasks, Sessions & Timeline Events](./domain-model-tasks-sessions-and-timeline-events.md)
- [Event Classification Engine](./event-classification-engine.md)
- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)

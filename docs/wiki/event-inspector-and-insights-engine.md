# Event Inspector & Insights Engine

event inspector는 선택된 event나 task를 "사람이 읽기 쉬운 설명"으로 재구성하는 패널이다.
원시 timeline event만 나열하면 파악이 어렵기 때문에, 이 영역이 실제 제품 가치의 상당 부분을 만든다.

## 핵심 파일

- `packages/web/src/components/EventInspector.tsx`
- `packages/web/src/lib/insights.ts`
- `packages/web/src/store/useEvaluation.ts`
- `packages/web/src/components/TaskEvaluatePanel.tsx`
- `packages/web/src/components/TaskHandoffPanel.tsx`

## 탭 구조

- `Inspector`
- `Tags`
- `Task`
- `Evaluate`
- `Compact`
- `Files`
- `Exploration`

즉, 단일 event detail뿐 아니라 task-level summary와 workflow evaluation까지 이 패널이 함께 가진다.

## `insights.ts`가 하는 일

`insights.ts`는 현재 매우 많은 파생 계산을 가진다.

- observability stats
- explored files / file activity
- compact insight
- task extraction
- display title 추론
- question/todo grouping
- tag insight
- verification 요약
- model summary
- handoff markdown / XML / system prompt 생성

실제로는 "인스펙터 전용 analytics engine"에 가깝다.

## 최근 코드 기준 포인트

### 평가 훅이 null-safe 해졌다

`useEvaluation(taskId)`는 이제 `null | undefined`를 허용하고,
task가 선택되지 않은 상태에서는 빈 ID 호출 없이 안전하게 초기화된다.

### 평가 UI와 라이브러리 UI가 분리됐다

task 내부 평가는 `TaskEvaluatePanel`, 전체 라이브러리 탐색은 `WorkflowLibraryPanel`이 맡는다.
역할이 조금 더 명확해졌다.

### core 타입 재사용이 늘었다

웹이 `TaskEvaluation`, `WorkflowSummary`, `TimelineEvent`를 `@monitor/core`에서 직접 가져오므로,
인스펙터가 읽는 데이터 shape와 서버 계약의 거리가 가까워졌다.

## 이 패널이 좋은 이유

- raw metadata를 사람이 읽을 수 있는 문장과 그룹으로 바꿔 준다.
- task handoff와 workflow evaluation 같은 고부가 기능이 자연스럽게 연결된다.
- 단순 디버깅을 넘어 "이 작업이 실제로 뭘 했는지"를 설명하는 역할을 한다.

## 현재 리스크

- UI와 derived analytics가 여전히 강하게 결합돼 있다.
- `insights.ts`가 너무 많은 책임을 가진다.
- metadata key 해석이 여러 함수와 컴포넌트에 퍼져 있어 이벤트 계약 변경에 취약할 수 있다.

## 관련 문서

- [Timeline Canvas](./timeline-canvas.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)

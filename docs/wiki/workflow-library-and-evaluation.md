# Workflow Library & Evaluation

workflow library는 Agent Tracer가 단순 추적 도구를 넘어서 "좋은 작업 방식을 다시 찾는 도구"가 되게 하는 기능이다.
작업이 끝난 뒤 평가를 저장하고, 이후 비슷한 작업에서 짧은 키워드로 예시를 다시 검색할 수 있다.

## 핵심 파일

- `packages/core/src/domain.ts`
- `packages/server/src/infrastructure/sqlite/sqlite-evaluation-repository.ts`
- `packages/server/src/application/workflow-context-builder.helpers.ts`
- `packages/server/src/presentation/http/routes/evaluation-routes.ts`
- `packages/web/src/components/WorkflowLibraryPanel.tsx`
- `packages/web/src/components/TaskEvaluatePanel.tsx`
- `packages/web/src/store/useEvaluation.ts`

## 데이터 모델

### `TaskEvaluation`

- `rating`: `good` | `skip`
- `useCase`
- `workflowTags`
- `outcomeNote`
- `evaluatedAt`

### `WorkflowSummary`

최근 코드 기준으로 `WorkflowSummary`가 `@monitor/core`에 승격됐다.
즉, workflow library 목록도 이제 공통 도메인 타입의 일부다.

### `WorkflowSearchResult`

workflow summary에 `workflowContext` markdown이 추가된 검색 결과 타입이다.

## 서버 기능

- `POST /api/tasks/:id/evaluate`
- `GET /api/tasks/:id/evaluate`
- `GET /api/workflows`
- `GET /api/workflows/similar`

`SqliteEvaluationRepository`는 단일 평가 조회, 전체 목록, 유사 검색을 모두 책임진다.

## 웹 기능

### TaskEvaluatePanel

selected task의 평가를 입력하고 저장한다.

### WorkflowLibraryPanel

TopBar의 `Library` 버튼으로 열리는 전체 워크플로우 브라우저다.
rating filter, text filter, task jump 기능을 가진다.

## workflow context markdown

유사 검색 결과에는 `buildWorkflowContext()`가 만든 markdown이 포함된다.
여기에는 보통 아래 정보가 들어간다.

- 원래 요청
- planning 레인 요약
- lane별 process summary
- 수정된 파일
- 미완료 TODO
- verification summary

즉, search 결과는 단순 메타데이터 목록이 아니라 다시 참고할 수 있는 압축된 handoff 문서에 가깝다.

## 현재 리스크

- 유사 검색 시 이벤트를 다시 많이 읽는다.
- LIKE 기반 검색이라 키워드 품질에 민감하다.
- 장기적으로는 요약 read model materialization이 필요할 수 있다.

## 관련 문서

- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
- [Searching Similar Workflows](./searching-similar-workflows.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)

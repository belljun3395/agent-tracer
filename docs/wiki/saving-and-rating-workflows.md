# Saving & Rating Workflows

workflow library에 task를 저장한다는 것은 별도 export 파일을 만드는 것이 아니라,
그 task에 evaluation row를 붙여 재사용 가능한 예시로 승격하는 것을 뜻한다.

## 저장 필드

- `rating`
- `useCase`
- `workflowTags`
- `outcomeNote`
- `evaluatedAt`

## 저장 경로

### 웹

`EventInspector`의 `Evaluate` 탭에서 `TaskEvaluatePanel`을 통해 저장한다.
`useEvaluation()`이 기존 값을 읽고, 저장 후 즉시 로컬 상태를 갱신한다.

### MCP / 에이전트

`monitor_evaluate_task` 도구를 통해 수동 저장도 가능하다.
워크플로우 라이브러리 운영 규칙상 보통 사용자에게 먼저 저장 의사를 묻고,
그 뒤 `good` 또는 `skip`과 메모를 함께 남긴다.

## `good`과 `skip`

- `good`: 다음에 다시 참고할 가치가 있는 작업
- `skip`: 라이브러리에는 남기되, 좋은 예시로 추천하지는 않을 작업

목록 정렬은 일반적으로 `good`이 먼저 오고, 그 안에서 최신 평가가 먼저 온다.

## 저장 후 어디에 쓰이는가

- `GET /api/workflows` 목록 패널
- `GET /api/workflows/similar` 유사 예시 검색
- 에이전트의 workflow library 검색 규칙

## 좋은 evaluation 메모의 기준

- 작업 종류가 짧고 명확해야 한다.
- 다음에 재사용 가능한 힌트가 들어 있어야 한다.
- 단순 결과보다 "어떤 접근이 잘 먹혔는지"가 중요하다.

## 관련 문서

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Searching Similar Workflows](./searching-similar-workflows.md)

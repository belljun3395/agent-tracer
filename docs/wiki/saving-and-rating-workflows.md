# Saving & Rating Workflows

workflow library에 task를 저장한다는 것은 별도 export 파일을 만드는 것이 아니라,
task evaluation과 workflow content를 함께 저장해 재사용 가능한 예시로 승격하는 것을 뜻한다.

## 저장되는 정보

### 평가 메타데이터

- `rating`
- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`
- `evaluatedAt`

### workflow content

서버 저장 레코드에는 아래도 함께 붙는다.

- `workflowSnapshot`
- `workflowContext`
- `searchText`

`searchText`는 별도 폼 필드가 아니라 snapshot의 검색용 문자열을 기준으로 저장된다.

## 저장 경로

### 웹

`EventInspector`의 `Evaluate` 탭에서 `TaskEvaluatePanel`을 통해 저장한다.

웹 경로는 단순 메모 입력만 하는 화면이 아니다.

1. evaluation 입력값을 받는다.
2. timeline에서 snapshot/context를 자동 생성한다.
3. 사용자가 Preview 또는 Edit fields로 생성값을 확인하고 수정할 수 있다.
4. `Regenerate`로 자동 생성값으로 되돌릴 수 있다.
5. 저장 시 `POST /api/tasks/:id/evaluate`에 evaluation + `workflowSnapshot` + `workflowContext`를 보낸다.

### MCP / 에이전트

`monitor_evaluate_task` 도구를 통해 수동 저장도 가능하다.
이 경로에서 직접 넘기는 값은 주로 평가 메타데이터다.

- `rating`
- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`

snapshot/context override를 보내지 않으면 서버가 현재 task timeline 기준으로 자동 생성해 저장한다.

## `good`과 `skip`

- `good`: 다음에 다시 참고할 가치가 있는 작업
- `skip`: 라이브러리에는 남기되, 추천 예시로는 우선하지 않을 작업

정렬은 일반적으로 `good`이 먼저 오고, 그 안에서 최신 `evaluatedAt`이 먼저 온다.

## 저장 후 어디에 쓰이는가

- `GET /api/workflows` 목록 패널
- `GET /api/workflows/similar` 유사 예시 검색
- `GET /api/workflows/:id/content` snapshot/context 상세 보기
- 에이전트의 workflow library 검색 규칙

## 좋은 evaluation 메모의 기준

- `useCase`는 짧고 분류 가능해야 한다.
- `outcomeNote`는 무엇이 해결됐는지 바로 드러나야 한다.
- `approachNote`는 왜 이 접근이 먹혔는지를 남겨야 한다.
- `reuseWhen`은 다음에 언제 다시 꺼내 볼지 알려줘야 한다.
- `watchouts`는 같은 실수를 반복하지 않도록 구체적이어야 한다.

## 관련 문서

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Searching Similar Workflows](./searching-similar-workflows.md)

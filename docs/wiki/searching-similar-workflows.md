# Searching Similar Workflows

유사 workflow 검색은 과거 task evaluation 중 현재 작업과 가까운 예시를 다시 찾는 기능이다.
현재 구현은 vector search가 아니라 SQLite LIKE 기반 검색이므로, 질의 방식이 결과 품질에 큰 영향을 준다.

## API

- `GET /api/workflows/similar?q=&tags=&limit=`
- MCP 도구: `monitor_find_similar_workflows`

## 현재 검색 방식

검색은 아래 필드를 대상으로 LIKE 패턴 매칭을 수행한다.

- task title
- `use_case`
- `workflow_tags`
- `outcome_note`

정렬은 보통 아래 순서를 따른다.

1. `good` 평가 우선
2. 최신 `evaluated_at` 우선

## 결과에 포함되는 것

- `taskId`
- `title`
- `useCase`
- `workflowTags`
- `outcomeNote`
- `rating`
- `eventCount`
- `createdAt`
- `workflowContext`

`workflowContext`는 선택된 task의 전체 이벤트를 읽어 서버에서 markdown으로 생성한 요약이다.

## 질의 작성 팁

- 긴 자연어 문장보다 짧은 핵심 키워드가 더 잘 맞는다.
- 예: `typescript refactor`, `java`, `workflow`, `documentation`
- `tags`는 정확도가 있을 때만 쓰고, 추측으로 넣으면 결과를 오히려 줄일 수 있다.

## 왜 짧은 키워드가 중요한가

현재 구현은 `%query%` 형태의 LIKE 매칭이라,
문장이 길어질수록 정확히 일치하는 부분 문자열이 나오기 어렵다.
그래서 에이전트 운영 규칙에서도 짧은 핵심 키워드를 권장한다.

## 비용 관점

검색 자체는 가볍지만, 결과마다 전체 이벤트를 다시 읽어 `workflowContext`를 만드는 비용이 있다.
라이브러리가 커지면 검색용 read model 또는 미리 계산된 summary가 필요해질 수 있다.

## 관련 문서

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Saving & Rating Workflows](./saving-and-rating-workflows.md)

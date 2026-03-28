# Searching Similar Workflows

유사 workflow 검색은 과거 task evaluation 중 현재 작업과 가까운 예시를 다시 찾는 기능이다.
현재 구현은 "lexical scoring + optional semantic ranking" 구조이며, semantic 검색이 없더라도 lexical fallback만으로 동작한다.

## API

- `GET /api/workflows/similar?q=&tags=&limit=`
- `GET /api/workflows/:id/content`
- MCP 도구: `monitor_find_similar_workflows`

`/api/workflows/similar`은 검색 결과용 요약 + `workflowContext`를 반환하고,
`/api/workflows/:id/content`는 전체 `workflowSnapshot`과 `workflowContext` 상세를 반환한다.

## 현재 검색 경로

`SqliteEvaluationRepository.searchSimilarWorkflows()`는 내부적으로 아래 순서로 동작한다.

1. `task_evaluations`, `monitoring_tasks`, `timeline_events`를 조합한 검색 row를 읽는다.
2. 필요하면 `tags` 필터를 적용한다.
3. lexical score를 계산한다.
4. embedding service가 있으면 semantic score도 계산한다.
5. semantic/lexical 결과를 합쳐 최종 순위를 정한다.
6. 상위 결과마다 workflow content를 hydrate해 `workflowContext`를 붙인다.

## lexical score에 쓰이는 필드

현재 lexical match는 아래 필드를 대상으로 계산된다.

- task `title`
- `use_case`
- `workflow_tags`
- `outcome_note`
- `approach_note`
- `reuse_when`
- `watchouts`
- `search_text`

특히 `search_text`는 snapshot 생성 단계에서 objective, request, outcome, approach, reuse hint, tags, key decisions, key files 등을 합쳐 만든다.

## semantic ranking

embedding service가 연결돼 있고 query가 비어 있지 않으면 semantic ranking을 추가한다.

- 각 evaluation row의 embedding이 있으면 cosine similarity를 계산한다.
- 최소 임계값 이상인 결과만 semantic match로 본다.
- semantic 검색이 실패하면 경고만 남기고 lexical search로 폴백한다.

즉, semantic search는 선택 기능이고, 기본 안전망은 lexical search다.

## 결과에 포함되는 것

`WorkflowSearchResult`에는 아래가 포함된다.

- `taskId`
- `title`
- `displayTitle` optional
- `useCase`
- `workflowTags`
- `outcomeNote`
- `approachNote`
- `reuseWhen`
- `watchouts`
- `rating`
- `eventCount`
- `createdAt`
- `workflowContext`

검색 결과에는 `workflowSnapshot` 전체가 바로 포함되지 않는다.
클라이언트가 상세 보기를 열면 `/api/workflows/:id/content`로 snapshot/context 전체를 다시 가져온다.

## 질의 작성 팁

- 긴 자연어 문장보다 짧은 핵심 키워드가 더 잘 맞는다.
- 예: `typescript refactor`, `workflow`, `documentation`
- lexical fallback이 항상 있으므로, query는 token이 또렷한 짧은 표현일수록 유리하다.
- `tags`는 부분 문자열 기준의 추가 필터라서, 확실할 때만 쓰는 편이 낫다.

에이전트 운영 규칙이 `tags`를 기본적으로 비워두는 이유도 recall을 불필요하게 줄이지 않기 위해서다.

## 왜 짧은 키워드가 중요한가

현재 lexical scoring은 정규화된 텍스트에 대해 query 전체 일치와 token 단위 일치를 함께 본다.
문장이 길어질수록 전체 일치도 약해지고, token 수가 늘어 lexical fallback 품질도 흔들릴 수 있다.

semantic ranking이 없는 환경에서도 잘 동작해야 하므로 짧은 핵심 키워드가 가장 안전하다.

## 비용 관점

- 검색 row 자체는 evaluation 테이블 중심으로 읽지만, 결과를 hydrate할 때는 task별 전체 timeline을 다시 읽는다.
- workflow content 생성에는 `displayTitle` 파생, snapshot 생성, context markdown 조립이 함께 들어간다.
- embedding 생성/저장은 비동기이며, 없거나 실패하면 lexical only 결과가 나온다.

라이브러리가 커지면 검색용 read model, precomputed content, lazy expansion 같은 최적화가 필요해질 수 있다.

## 관련 문서

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)

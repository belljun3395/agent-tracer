# HTTP API Reference

Agent Tracer 서버는 크게 admin/read API, lifecycle API, event logging API,
bookmark API, search API, workflow library API로 나뉜다.
라우트 구현은 `packages/server/src/presentation/http/routes/*.ts`에 분산돼 있지만,
실제 의미는 `MonitorService` 한곳으로 수렴한다.

## 핵심 파일

- `packages/server/src/presentation/http/create-router.ts`
- `packages/server/src/presentation/http/routes/admin-routes.ts`
- `packages/server/src/presentation/http/routes/lifecycle-routes.ts`
- `packages/server/src/presentation/http/routes/event-routes.ts`
- `packages/server/src/presentation/http/routes/bookmark-routes.ts`
- `packages/server/src/presentation/http/routes/search-routes.ts`
- `packages/server/src/presentation/http/routes/evaluation-routes.ts`
- `packages/server/src/presentation/schemas.ts`

## 1. Admin / Read API

- `GET /health`
- `GET /api/overview`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`

이 그룹은 대시보드 초기 로딩과 상세 조회의 기본 read model을 제공한다.

## 2. Lifecycle API

- `POST /api/task-start`
- `POST /api/task-link`
- `POST /api/task-complete`
- `POST /api/task-error`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/finished`
- `DELETE /api/tasks/:taskId`
- `POST /api/session-end`
- `POST /api/runtime-session-ensure`
- `POST /api/runtime-session-end`

runtime-scoped adapter와 explicit session/task control을 모두 지원하는 것이 특징이다.

## 3. Event Logging API

- `POST /api/tool-used`
- `POST /api/terminal-command`
- `POST /api/save-context`
- `POST /api/explore`
- `POST /api/plan`
- `POST /api/action`
- `POST /api/verify`
- `POST /api/rule`
- `POST /api/async-task`
- `POST /api/agent-activity`
- `POST /api/user-message`
- `POST /api/question`
- `POST /api/todo`
- `POST /api/thought`
- `POST /api/assistant-response`
- `PATCH /api/events/:eventId`

즉, 대부분의 timeline card는 이 그룹에서 생성된다.

## 4. Bookmark / Search API

- `GET /api/bookmarks`
- `POST /api/bookmarks`
- `DELETE /api/bookmarks/:bookmarkId`
- `GET /api/search`

bookmark는 task 또는 특정 event에 붙을 수 있고,
search는 free-text query와 optional task scope를 지원한다.

## 5. Workflow Library API

- `POST /api/tasks/:id/evaluate`
- `GET /api/tasks/:id/evaluate`
- `GET /api/workflows`
- `GET /api/workflows/similar`

최근 코드 기준으로 `GET /api/workflows`가 추가돼,
웹의 `WorkflowLibraryPanel`이 전체 라이브러리를 직접 읽을 수 있다.

## request validation

모든 쓰기 경로는 `presentation/schemas.ts`의 Zod schema를 통해 request body를 검증한다.
특히 canonical contract가 중요한 `user.message`, `question`, `todo`, `runtime-session-*`
계열은 schema가 실질적인 방어선 역할을 한다.
`schemas.constants.ts`에 열거형 값들을 분리해두어 여러 schema에서 중복 문자열 사용을 줄였다.

## 에러 처리

`create-app.ts` 기준 현재 정책은 아래와 같다.

- `ZodError` -> 400
- `error.status` 또는 `error.statusCode`가 있으면 해당 값 사용
- 그 외는 500

예전처럼 대부분을 400으로 뭉뚱그리는 구조가 아니라, 최소한 validation failure와
internal error는 구분되는 방향으로 정리됐다.

## 새 API를 추가할 때 같이 건드릴 곳

1. application input type
2. Zod schema
3. route registration
4. `MonitorService`
5. 필요 시 SQLite repository/read model
6. MCP tool surface 또는 runtime adapter
7. web API client와 위키/guide 문서

## 관련 문서

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)

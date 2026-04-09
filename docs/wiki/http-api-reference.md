# HTTP API Reference

Agent Tracer 서버는 admin/read API, lifecycle API, event logging API,
bookmark API, search API, workflow library API 로 나뉜다.
현재 HTTP 표면은 NestJS controller 로 구현되어 있고,
실제 의미는 `MonitorService` 한곳으로 수렴한다.

## 핵심 파일

- `packages/server/src/presentation/nestjs/controllers/admin.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/lifecycle.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/event.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/bookmark.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/search.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/evaluation.controller.ts`
- `packages/server/src/presentation/schemas.ts`

## 1. Admin / Read API

- `GET /health`
- `GET /api/overview`
- `GET /api/tasks`
- `GET /api/default-workspace`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/:taskId/observability`
- `GET /api/tasks/:taskId/openinference`
- `GET /api/observability/overview`

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

## 4. Bookmark / Search API

- `GET /api/bookmarks`
- `POST /api/bookmarks`
- `DELETE /api/bookmarks/:bookmarkId`
- `GET /api/search`

## 5. Workflow Library API

- `POST /api/tasks/:id/evaluate`
- `GET /api/tasks/:id/evaluate`
- `GET /api/workflows`
- `GET /api/workflows/similar`
- `GET /api/workflows/:id/content`

## Request validation

모든 쓰기 경로는 `presentation/schemas.ts` 의 Zod schema 를 통해 request body 를 검증한다.
특히 canonical contract 가 중요한 `user.message`, `question`, `todo`, `runtime-session-*`
계열은 schema 가 실질적인 방어선 역할을 한다.

## 관련 문서

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)

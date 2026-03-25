# HTTP API Reference

서버는 lifecycle, event logging, search, bookmark, evaluation 계열 API를 제공한다.

## 주요 그룹

- admin: `/health`, `/api/overview`, `/api/tasks`
- lifecycle: `task-start`, `task-complete`, `session-end`, `runtime-session-ensure`
- events: `tool-used`, `explore`, `plan`, `verify`, `rule`, `user-message`, `assistant-response`
- bookmarks: `/api/bookmarks`
- search: `/api/search`
- workflows: `/api/tasks/:id/evaluate`, `/api/workflows`, `/api/workflows/similar`

## 핵심 파일

- `packages/server/src/presentation/http/routes/`
- `packages/server/src/presentation/schemas.ts`

## 유지보수 메모

- route, schema, service, MCP가 함께 수정되는 경우가 많다.
- 새 이벤트를 추가할 때 체크리스트를 문서화하는 것이 중요하다.

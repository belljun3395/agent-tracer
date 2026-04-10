# HTTP API Reference

Agent Tracer 서버는 admin/read API, lifecycle API, event ingestion API,
bookmark API, search API, workflow library API 로 나뉜다.
현재 HTTP 표면은 NestJS controller 로 구현되어 있고,
실제 의미는 `MonitorService` 한곳으로 수렴한다.

## 핵심 파일

- `packages/server/src/presentation/nestjs/controllers/admin.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/lifecycle.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/event.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/ingest.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/bookmark.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/search.controller.ts`
- `packages/server/src/presentation/nestjs/controllers/evaluation.controller.ts`
- `packages/server/src/presentation/schemas.ts`
- `packages/server/src/presentation/schemas.ingest.ts`
- `packages/server/src/application/services/event-ingestion-service.ts`

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

생성·종료·연결 등 상태 변이가 명시적인 경로다.
이 경로들은 event ingestion으로 통합되지 않는다.

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

## 3. Unified Event Ingestion API (권장)

v0.1.4 이후 신규 클라이언트는 단일 엔드포인트로 모든 이벤트를 전송한다.

### `POST /ingest/v1/events`

```http
POST /ingest/v1/events
Content-Type: application/json

{
  "events": [
    {
      "kind": "tool.used",
      "taskId": "...",
      "sessionId": "...",
      "toolName": "Edit",
      "title": "Edit: foo.ts",
      "lane": "implementation",
      "metadata": { ... }
    }
  ]
}
```

한 번에 최대 100개 이벤트를 배치로 보낼 수 있다.
각 이벤트는 `kind` 필드로 분기한다.

#### 지원 kind 목록

| kind | 설명 |
|------|------|
| `tool.used` | 파일 편집, 도구 사용 (lane 필드로 exploration 구분) |
| `terminal.command` | Bash 명령 실행 |
| `context.saved` | 컨텍스트 압축/저장 (compaction, session 시작) |
| `plan.logged` | 계획 단계 기록 |
| `action.logged` | 액션 기록; `asyncTaskId` 있으면 async lifecycle |
| `verification.logged` | 검증 결과 기록 |
| `rule.logged` | 규칙/정책 적용 기록 |
| `agent.activity.logged` | delegation, skill_use, mcp_call 기록 |
| `user.message` | 사용자 입력 |
| `question.logged` | 질문 플로우 |
| `todo.logged` | Todo 항목 상태 변화 |
| `thought.logged` | 요약 사고/추론 기록 |
| `assistant.response` | 어시스턴트 응답 |

#### 응답

```json
{
  "ok": true,
  "data": {
    "accepted": [{ "eventId": "...", "kind": "tool.used", "taskId": "..." }],
    "rejected": []
  }
}
```

유효성 검사 실패 시 `400` + `{ ok: false, error: { code, message, details } }`.

#### 스키마 위치

- 요청 schema: `packages/server/src/presentation/schemas.ingest.ts`
- 서비스 dispatch: `packages/server/src/application/services/event-ingestion-service.ts`

## 4. Legacy Event Logging API (하위 호환 유지)

개별 엔드포인트는 기존 클라이언트를 위해 그대로 존재한다.
새 클라이언트는 `/ingest/v1/events` 를 사용할 것을 권장한다.

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

## 5. Bookmark / Search API

- `GET /api/bookmarks`
- `POST /api/bookmarks`
- `DELETE /api/bookmarks/:bookmarkId`
- `GET /api/search`

## 6. Workflow Library API

- `POST /api/tasks/:id/evaluate`
- `GET /api/tasks/:id/evaluate`
- `GET /api/workflows`
- `GET /api/workflows/similar`
- `GET /api/workflows/:id/content`

## Request validation

모든 쓰기 경로는 Zod schema 를 통해 request body 를 검증한다.
`/ingest/v1/events` 는 `ingestEventsBatchSchema` (schemas.ingest.ts),
기존 경로들은 `presentation/schemas.ts` 를 사용한다.

## 관련 문서

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)

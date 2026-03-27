# Monitor Server

`@monitor/server`는 Agent Tracer의 중심 패키지다. 에이전트가 보낸 관측 이벤트를
task/session/timeline event로 정리해 저장하고, HTTP와 WebSocket을 통해
읽기 모델을 노출한다. 제품 관점에서 보면 "기록 엔진"과 "조회 API"가 한 패키지에 모여 있다.

## 이 패키지가 담당하는 것

- task, session, runtime-session lifecycle
- timeline event 기록과 분류 결과 저장
- bookmark CRUD
- workflow evaluation 저장과 유사 워크플로우 검색
- overview/task detail/read model 제공
- WebSocket 실시간 알림 브로드캐스트

## 핵심 파일

- `packages/server/src/bootstrap/create-monitor-runtime.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/presentation/create-app.ts`
- `packages/server/src/presentation/http/create-router.ts`
- `packages/server/src/infrastructure/sqlite/index.ts`
- `packages/server/src/presentation/ws/event-broadcaster.ts`
- `packages/server/src/presentation/schemas.ts`

## 부트스트랩 흐름

서버 조합은 `createMonitorRuntime()` 하나로 읽을 수 있다.

1. `EventBroadcaster`를 만든다.
2. `createSqliteMonitorPorts()`로 SQLite repository와 notifier를 조합한다.
3. `MonitorService`를 생성한다.
4. `createApp()`으로 Express app을 만든다.
5. HTTP server와 `WebSocketServer`를 붙인다.
6. 새 WebSocket 연결에는 overview + task list snapshot을 즉시 보낸다.

이 구조 덕분에 실제 런타임 조합 지점이 흩어지지 않고 한 파일에 모여 있다.

## 내부 레이어

### Application

`MonitorService`와 helper service들이 유스케이스를 담당한다.
task start/complete, runtime-session ensure/end, event logging, bookmark,
evaluation, search가 모두 여기서 처리된다.

### Presentation

Express route 모듈과 WebSocket broadcaster가 여기에 있다.
라우트는 비교적 얇고, request validation 뒤에 service 호출만 위임한다.

### Infrastructure

SQLite repository 구현과 schema/migration 로직이 여기에 있다.
현재 실제 활성 저장 경로는 `src/infrastructure/sqlite/*`다.

## 최근 코드 기준 포인트

### HTTP 에러 매핑이 더 명시적이다

`create-app.ts`는 이제 `ZodError`를 400으로 분기하고,
status/statusCode가 달린 에러는 해당 값을 사용하며, 나머지는 500으로 처리한다.
 문서나 테스트도 이제 이 동작을 기준으로 보는 것이 맞다.

### 스키마 상수 분리가 적용되었다

`presentation/schemas.ts`는 `TASK_KINDS`, `TASK_STATUSES`, `EVENT_LANES`,
`QUESTION_PHASES`, `TODO_STATES`, `AGENT_ACTIVITY_TYPES`, `TASK_RELATION_TYPES`,
`ASYNC_LIFECYCLE_STATUSES`, `COMPLETION_REASONS`, `CAPTURE_MODES`를
`schemas.constants.ts`에서 가져와 공통 열거값을 중앙화한다.
동일한 값 문자열이 여러 schema에 흩어지는 위험을 줄이고, schema-only 변경 시
점검 범위를 더 작게 유지할 수 있게 됐다.

### workflow library read path가 정식 API가 됐다

평가 저장뿐 아니라 `GET /api/workflows`로 전체 라이브러리 목록을 읽을 수 있다.
웹의 `WorkflowLibraryPanel`은 이 경로를 직접 사용한다.

### runtime session과 explicit session-end가 공존한다

Claude/Codex 계열은 `runtime-session-ensure/end`를 많이 쓰고,
OpenCode 같은 경로는 `task-start`와 `session-end`를 더 직접적으로 사용한다.

## 이 패키지를 읽을 때의 추천 순서

1. `src/bootstrap/create-monitor-runtime.ts`
2. `src/application/monitor-service.ts`
3. `src/presentation/http/routes/*.ts`
4. `src/infrastructure/sqlite/index.ts`
5. `src/presentation/ws/event-broadcaster.ts`

## 관련 문서

- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [HTTP API Reference](./http-api-reference.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)
- [Backend Server](./backend-server.md)

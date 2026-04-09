# Monitor Server

`@monitor/server` 는 Agent Tracer 의 중심 패키지다.
에이전트가 보낸 관측 이벤트를 task/session/timeline event 로 정리해 저장하고,
HTTP 와 WebSocket 을 통해 읽기 모델을 노출한다.

## 이 패키지가 담당하는 것

- task, session, runtime-session lifecycle
- timeline event 기록과 분류 결과 저장
- bookmark CRUD
- workflow evaluation 저장과 유사 워크플로우 검색
- overview/task detail/observability read model 제공
- WebSocket 실시간 알림 브로드캐스트

## 핵심 파일

- `packages/server/src/index.ts`
- `packages/server/src/bootstrap/create-nestjs-monitor-runtime.ts`
- `packages/server/src/presentation/nestjs/app.module.ts`
- `packages/server/src/presentation/nestjs/controllers/*.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/infrastructure/sqlite/index.ts`
- `packages/server/src/presentation/ws/event-broadcaster.ts`
- `packages/server/src/presentation/schemas.ts`

## 부트스트랩 흐름

현재 서버 조합 루트는 `createNestMonitorRuntime()` 하나다.

1. `EventBroadcaster` 를 만든다.
2. `NestFactory.create(AppModule.forRoot(...))` 로 SQLite ports 와 `MonitorServiceProvider` 를 조합한다.
3. HTTP server 와 `WebSocketServer` 를 붙인다.
4. `/ws` 업그레이드 요청만 받아 WebSocket 연결을 연다.
5. 새 WebSocket 연결에는 overview + task list snapshot 을 즉시 보낸다.

## 내부 레이어

### Application

`MonitorService` 와 helper service 들이 유스케이스를 담당한다.
task start/complete, runtime-session ensure/end, event logging, bookmark,
evaluation, search 가 모두 여기서 처리된다.

### Presentation

NestJS controller 집합과 WebSocket broadcaster 가 여기에 있다.
HTTP 표면은 controller 들이, realtime 알림은 `EventBroadcaster` 가 맡는다.

### Infrastructure

SQLite repository 구현과 schema/migration 로직이 여기에 있다.
현재 실제 활성 저장 경로는 `src/infrastructure/sqlite/*` 다.

## 최근 코드 기준 포인트

- 기본 실행 경로는 NestJS 다.
- canonical `runtimeSource` 는 `claude-plugin` 이다.
- workflow library read path 와 observability read model 이 정식 API 로 제공된다.
- runtime session 과 explicit session-end 가 공존하므로 자동 plugin 과 수동 클라이언트를 함께 받을 수 있다.

## 이 패키지를 읽을 때의 추천 순서

1. `src/index.ts`
2. `src/bootstrap/create-nestjs-monitor-runtime.ts`
3. `src/presentation/nestjs/controllers/*.ts`
4. `src/application/monitor-service.ts`
5. `src/infrastructure/sqlite/index.ts`

## 관련 문서

- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [HTTP API Reference](./http-api-reference.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)
- [Backend Server](./backend-server.md)

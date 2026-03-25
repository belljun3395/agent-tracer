# Monitor Server

`@monitor/server`는 Agent Tracer의 저장, 조회, 브로드캐스트를 담당하는 중심 패키지다.

## 담당 역할

- task/session/event lifecycle 처리
- HTTP API 제공
- SQLite 영속성
- WebSocket 브로드캐스트
- workflow evaluation/search

## 핵심 파일

- `packages/server/src/bootstrap/create-monitor-runtime.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/server/src/presentation/create-app.ts`
- `packages/server/src/infrastructure/sqlite/index.ts`

## 함께 볼 문서

- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [HTTP API Reference](./http-api-reference.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)

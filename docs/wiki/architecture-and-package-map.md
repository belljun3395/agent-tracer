# Architecture & Package Map

Agent Tracer는 모노레포 형태로 구성되고, 큰 틀에서는 ports-and-adapters 스타일을 따른다.

## 패키지 역할

- `@monitor/core`: 공통 계약과 분류 로직
- `@monitor/server`: 애플리케이션 서비스, HTTP, SQLite, WebSocket
- `@monitor/mcp`: MCP tool surface
- `@monitor/web`: React 대시보드

## 의존 방향

```text
core -> server
core -> mcp
core -> web
server -> web (API boundary only)
```

## 조합 루트

- 서버 조합: `packages/server/src/bootstrap/create-monitor-runtime.ts`
- 웹 진입: `packages/web/src/main.tsx`
- MCP 진입: `packages/mcp/src/index.ts`

## 유지보수 메모

- 패키지 경계는 좋지만, 일부 계약 중복과 legacy 구현이 혼란을 만든다.
- 자세한 평가는 [Backend Server](./backend-server.md), [Frontend Dashboard](./frontend-dashboard.md), [Runtime Integrations](./runtime-integrations.md) 참고.

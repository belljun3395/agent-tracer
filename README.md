# Agent Tracer

Claude Code, OpenCode, Codex 등 AI CLI 에이전트가 작업할 때의 행동을 실시간으로 추적하는 로컬 모니터링 대시보드.

## 빠른 시작

```bash
npm install
npm run build
npm run dev        # 서버 + 대시보드 동시 실행
```

대시보드: http://127.0.0.1:5173
서버: http://127.0.0.1:3847

## 에이전트 통합

→ `docs/guide/llm-setup.md` 참고

## 패키지

| 패키지 | 역할 |
|--------|------|
| `@monitor/core` | 타입, 규칙, 이벤트 분류 |
| `@monitor/server` | Express + SQLite + WebSocket API |
| `@monitor/mcp` | MCP stdio 서버 (14개 모니터링 도구) |
| `@monitor/web` | React 19 대시보드 (Vite) |

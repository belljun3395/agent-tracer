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

## Thought-Flow Observability

대시보드는 이제 단순 이벤트 목록 외에 다음 진단 정보를 함께 보여준다.

- 상단 diagnostics 카드: prompt capture 비율, explicit flow coverage, stale running task, 평균 작업 시간
- Inspector `Flow` 탭: phase breakdown, active/waiting duration, session 상태, top files/tags, work item/goal/plan/handoff focus
- Inspector `Health` 탭: question/todo closure, rule gap, coordination/background activity, runtime lineage

세부 계약과 API는 `docs/guide/task-observability.md` 참고.

## 패키지

| 패키지 | 역할 |
|--------|------|
| `@monitor/core` | 타입, 규칙, 이벤트 분류 |
| `@monitor/server` | Express + SQLite + WebSocket API |
| `@monitor/mcp` | MCP stdio 서버 (14개 모니터링 도구) |
| `@monitor/web` | React 19 대시보드 (Vite) |

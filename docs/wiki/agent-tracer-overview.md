# Agent Tracer Overview

Agent Tracer는 Claude Code, OpenCode, Codex 같은 AI 에이전트의 작업 흐름을 기록하고
대시보드와 워크플로우 라이브러리로 다시 탐색할 수 있게 하는 로컬 모니터링 시스템이다.

## 핵심 능력

- 에이전트 행동을 8개 lane으로 분류해 시각화
- 여러 런타임의 hook / plugin / skill / MCP 경로 지원
- SQLite 기반 기록 저장과 검색
- 성공한 작업을 워크플로우 라이브러리로 재사용

## 주요 패키지

- `@monitor/core`
- `@monitor/server`
- `@monitor/mcp`
- `@monitor/web`

## 먼저 볼 문서

- [Architecture & Package Map](./architecture-and-package-map.md)
- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Monitor Server](./monitor-server.md)
- [Web Dashboard](./web-dashboard.md)

## 보강 문서

- [System Overview](./system-overview.md)
- [Maintainability Review (2026-03-25)](./maintainability-review-2026-03-25.md)

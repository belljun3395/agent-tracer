# Agent Tracer Wiki

이 폴더는 설치 가이드가 아니라 "코드베이스를 이해하기 위한 문서"를 모아 둔 위키다.
기존 `docs/guide`가 외부 프로젝트 연결과 런타임 설정에 초점을 둔다면,
여기는 저장소 구조, 이벤트 모델, 패키지 경계, 유지보수 리스크를 빠르게 파악하는 데 초점을 둔다.

이번 정리는 공개된 DeepWiki의 섹션 구조를 참고해, 로컬에서도 비슷한 정보 구조로 탐색할 수 있게 재편한 것이다.
차이는 하나 있다. DeepWiki가 코드 스냅샷 중심이라면, 여기 문서는 maintainer 관점에서
"현재 실제 활성 경로"와 "정리해야 할 legacy"를 같이 적는다.

## Quick Start

1. [Agent Tracer Overview](./agent-tracer-overview.md)
2. [Getting Started & Installation](./getting-started-and-installation.md)
3. [Architecture & Package Map](./architecture-and-package-map.md)
4. [Monitor Server](./monitor-server.md)
5. [Web Dashboard](./web-dashboard.md)
6. [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
7. [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
8. [Testing & Development](./testing-and-development.md)

## DeepWiki-Aligned Map

### Overview

- [Agent Tracer Overview](./agent-tracer-overview.md)
- [Getting Started & Installation](./getting-started-and-installation.md)
- [Architecture & Package Map](./architecture-and-package-map.md)

### Core Domain

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Domain Model: Tasks, Sessions & Timeline Events](./domain-model-tasks-sessions-and-timeline-events.md)
- [Event Classification Engine](./event-classification-engine.md)
- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)

### Server

- [Monitor Server](./monitor-server.md)
- [MonitorService: Application Layer](./monitorservice-application-layer.md)
- [HTTP API Reference](./http-api-reference.md)
- [SQLite Infrastructure & Schema](./sqlite-infrastructure-and-schema.md)
- [WebSocket Real-Time Broadcasting](./websocket-real-time-broadcasting.md)

### MCP

- [MCP Server](./mcp-server.md)
- [MCP Tool Reference](./mcp-tool-reference.md)
- [MonitorClient & Transport Layer](./monitorclient-and-transport-layer.md)

### Runtime Adapters

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [Claude Code Hooks Adapter](./claude-code-hooks-adapter.md)
- [OpenCode Plugin Adapter](./opencode-plugin-adapter.md)
- [Codex Skill Adapter](./codex-skill-adapter.md)
- [setup:external Automation Script](./setup-external-automation-script.md)

### Web

- [Web Dashboard](./web-dashboard.md)
- [Task List & Global State](./task-list-and-global-state.md)
- [Timeline Canvas](./timeline-canvas.md)
- [Event Inspector & Insights Engine](./event-inspector-and-insights-engine.md)
- [API Client & UI Utilities](./api-client-and-ui-utilities.md)

### Workflows

- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
- [Saving & Rating Workflows](./saving-and-rating-workflows.md)
- [Searching Similar Workflows](./searching-similar-workflows.md)

### Testing

- [Testing & Development](./testing-and-development.md)
- [Server-Side Tests](./server-side-tests.md)
- [Web & Core Tests](./web-and-core-tests.md)
- [Glossary](./glossary.md)

## Maintainer Notes

아래 문서는 DeepWiki 정렬본과 별개로, 유지보수 관점의 보강 문서다.

- [System Overview](./system-overview.md)
- [Backend Server](./backend-server.md)
- [Frontend Dashboard](./frontend-dashboard.md)
- [Runtime Integrations](./runtime-integrations.md)
- [Quality And Testing](./quality-and-testing.md)
- [Maintainability Review (2026-03-25)](./maintainability-review-2026-03-25.md)

## 패키지 지도

| Package | 역할 | 현재 상태 |
| --- | --- | --- |
| `packages/core` | 공통 도메인 타입, 이벤트 분류, 런타임 capability | 계약의 중심축 역할이 분명하다. |
| `packages/server` | Express + SQLite + WebSocket + application service | 레이어링은 좋지만 `MonitorService`와 일부 인프라가 비대하다. |
| `packages/mcp` | monitor-server MCP stdio 어댑터 | 기능은 명확하지만 등록 코드가 반복적이다. |
| `packages/web` | React 19 대시보드 | 기능은 풍부하지만 UI/상태/도메인 계산이 몇몇 거대 파일에 집중되어 있다. |

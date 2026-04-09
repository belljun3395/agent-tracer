# Agent Tracer Wiki

이 폴더는 설치 가이드가 아니라, Agent Tracer 코드베이스를 유지보수자 관점에서 빠르게
이해하기 위한 위키다. `docs/guide`가 "외부 프로젝트에 어떻게 붙이는가"를 설명한다면,
여기는 "이 저장소 안에서 무엇이 어디에 있고 어떤 책임을 가지는가"를 설명한다.

이번 정리는 공개된 DeepWiki의 정보 구조를 기준으로 다시 맞췄다. 다만 그대로 복제하지 않고,
현재 코드 경로와 유지보수 포인트, legacy 흔적, 확장 시 주의점까지 로컬 관점에서 덧붙였다.

## 읽는 순서

처음 따라갈 때는 아래 순서가 가장 빠르다.

1. [Agent Tracer Overview](./agent-tracer-overview.md)
2. [Getting Started & Installation](./getting-started-and-installation.md)
3. [Architecture & Package Map](./architecture-and-package-map.md)
4. [Core Domain & Event Model](./core-domain-and-event-model.md)
5. [Monitor Server](./monitor-server.md)
6. [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
7. [Web Dashboard](./web-dashboard.md)
8. [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
9. [Testing & Development](./testing-and-development.md)

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
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
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

## Deep Dives

아래 문서는 위 목록을 보강하는 maintainer용 확장 문서다. 특정 영역의 부채나 설계
리뷰까지 같이 보고 싶을 때 읽는다.

- [System Overview](./system-overview.md)
- [Backend Server](./backend-server.md)
- [Frontend Dashboard](./frontend-dashboard.md)
- [Runtime Integrations](./runtime-integrations.md)
- [Quality And Testing](./quality-and-testing.md)

## 패키지 지도

| Package | 역할 | 지금 읽어야 할 파일 |
| --- | --- | --- |
| `packages/core` | 공통 도메인 타입, 이벤트 분류, 런타임 capability registry | `src/domain.ts`, `src/domain/*`, `src/classifier.ts`, `src/runtime-capabilities.ts` |
| `packages/server` | NestJS 서버 런타임, SQLite repository, runtime session 관리, WebSocket broadcast | `src/index.ts`, `src/bootstrap/create-nestjs-monitor-runtime.ts`, `src/application/monitor-service.ts` |
| `packages/mcp` | monitor-server HTTP API를 MCP tool surface로 노출 | `src/index.ts`, `src/client.ts` |
| `packages/web` | React 19 기반 실시간 대시보드와 워크플로우 라이브러리 UI | `src/App.tsx`, `src/store/useMonitorStore.tsx`, `src/components/Timeline.tsx` |

## 이 위키를 업데이트할 때의 기준

- 문서는 실제 코드 경로를 기준으로 적는다. 삭제 대상 legacy는 "현재 경로"와 분리해서 표시한다.
- 한 페이지만 읽어도 책임, 주요 파일, 핵심 흐름, 관련 문서를 알 수 있게 유지한다.
- `docs/guide`와 중복될 때는 설정 절차보다 코드 구조를 우선 설명하고, 실행 방법은 가이드로 링크한다.
- 런타임 동작처럼 시간이 지나며 바뀌기 쉬운 내용은 `packages/core/src/runtime-capabilities.ts`와
  `docs/guide/*-setup.md`를 먼저 확인한 뒤 반영한다.

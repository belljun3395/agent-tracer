# Agent Tracer Overview

Agent Tracer는 Claude Code, OpenCode, Codex 같은 AI CLI 에이전트의 작업을
"나중에 다시 읽을 수 있는 실행 기록"으로 바꾸는 로컬 모니터링 시스템이다.
핵심은 단순 로그 저장이 아니라, 에이전트 작업을 task, session, timeline event,
workflow evaluation으로 구조화해 디버깅과 재사용이 가능하게 만든다는 점이다.

## 이 시스템이 하는 일

- 에이전트 행동을 8개 lane으로 분류해 실시간 타임라인으로 보여준다.
- 여러 런타임의 hook, plugin, skill, MCP 호출을 하나의 공통 이벤트 모델로 수렴한다.
- SQLite에 모든 기록을 저장하고 WebSocket으로 대시보드에 브로드캐스트한다.
- 완료된 작업을 `good` 또는 `skip`으로 평가해 워크플로우 라이브러리로 재사용한다.

## 주요 구성 요소

### `@monitor/core`

공통 언어 계층이다. `TimelineLane`, `MonitoringTask`, `TimelineEvent`,
runtime capability registry, event classifier가 모두 여기에 있다.
서버, MCP, 웹이 같은 타입 체계를 공유해야 하므로 사실상의 source of truth다.

### `@monitor/server`

애플리케이션 계층과 인프라 계층이다. Express API, SQLite repository,
runtime session binding, workflow search, WebSocket broadcast를 담당한다.

### `@monitor/mcp`

모니터링 HTTP API를 에이전트가 직접 호출할 수 있는 MCP tool surface로 포장한다.
Codex 같은 수동 경로에서 특히 중요하다.

### `@monitor/web`

태스크 목록, 타임라인, 이벤트 인스펙터, 워크플로우 라이브러리를 제공하는
React 19 기반 대시보드다.

## End-to-End 흐름

1. 런타임 어댑터가 hook, plugin, skill, MCP 중 하나로 Agent Tracer에 이벤트를 보낸다.
2. 서버는 `MonitorService`를 통해 task/session/event를 생성하거나 갱신한다.
3. SQLite repository가 이를 영속화한다.
4. `EventBroadcaster`가 변경 사항을 WebSocket으로 브로드캐스트한다.
5. 웹 대시보드는 overview, selected task detail, bookmark/evaluation 상태를 새로고친다.

## 핵심 개념

### Task

사용자 목표 단위다. 하나의 "작업 주제"를 표현하며 상태는 `running`, `waiting`,
`completed`, `errored` 중 하나다. background task와 parent-child 관계도 지원한다.

### Session

한 task 안의 개별 에이전트 실행 구간이다. Claude hook처럼 turn이 나뉘는 런타임에서는
runtime session binding을 통해 같은 task에 여러 session이 이어 붙을 수 있다.

### Timeline Event

user message, tool usage, terminal command, verification, todo, question,
assistant response 같은 개별 관측 단위다. 모두 lane, metadata, classification을 가진다.

### Workflow Library

작업이 끝난 뒤 평가된 task를 검색 가능한 예시 집합으로 남기는 계층이다.
이 저장소의 차별점은 "실시간 추적"뿐 아니라 "좋았던 작업 방식을 다음에 다시 찾는 것"까지
한 제품 안에서 지원한다는 데 있다.

## 먼저 읽을 파일

- `README.md`
- `packages/core/src/domain.ts`
- `packages/server/src/bootstrap/create-monitor-runtime.ts`
- `packages/server/src/application/monitor-service.ts`
- `packages/mcp/src/index.ts`
- `packages/web/src/App.tsx`

## 다음 문서

- [Getting Started & Installation](./getting-started-and-installation.md)
- [Architecture & Package Map](./architecture-and-package-map.md)
- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Monitor Server](./monitor-server.md)
- [Web Dashboard](./web-dashboard.md)

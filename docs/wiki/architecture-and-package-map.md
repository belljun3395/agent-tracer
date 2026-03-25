# Architecture & Package Map

Agent Tracer는 npm workspace 기반 TypeScript 모노레포이며,
전체 구조는 "공통 계약(core) + 애플리케이션 서버(server) + 에이전트 어댑터(mcp)
+ 프레젠테이션(web)"로 읽는 것이 가장 쉽다. 전형적인 ports-and-adapters 성향이 있지만,
실제 운영은 composition root와 shared domain contract가 중심축 역할을 한다.

## 패키지 맵

| Package | 역할 | 대표 파일 |
| --- | --- | --- |
| `@monitor/core` | 도메인 타입, event classifier, runtime capability registry | `src/domain.ts`(barrel), `src/domain/*`, `src/classifier.ts`, `src/runtime-capabilities.ts`(barrel) |
| `@monitor/server` | Express API, application service, SQLite repository, WebSocket broadcaster | `src/bootstrap/create-monitor-runtime.ts`, `src/application/monitor-service.ts` |
| `@monitor/mcp` | 서버 API를 MCP tool 집합으로 노출 | `src/index.ts`, `src/client.ts` |
| `@monitor/web` | 대시보드 UI, overview/task detail fetch, realtime refresh | `src/App.tsx`, `src/store/useMonitorStore.tsx`, `src/components/Timeline.tsx` |

## 의존 방향

코드 의존성은 대체로 아래 방향을 따른다.

```text
@monitor/core
  ├─> @monitor/server
  ├─> @monitor/mcp
  └─> @monitor/web

@monitor/server <----HTTP/WebSocket----> @monitor/web
@monitor/mcp ----HTTP-------------------> @monitor/server
```

중요한 점은 `server`가 `web` 패키지를 import하지 않는다는 것이다.
두 패키지는 런타임 통신으로만 연결되고, 공통 타입 의미는 `core`가 잡아 준다.

## 조합 루트

### 서버 런타임 조합

`packages/server/src/bootstrap/create-monitor-runtime.ts`가 단일 composition root다.
이곳에서 SQLite ports, `MonitorService`, Express app, HTTP server, WebSocket server를 묶는다.

### MCP 진입점

`packages/mcp/src/index.ts`는 24개의 monitoring tool을 등록하고,
각 도구를 monitor server의 HTTP endpoint로 매핑한다.

### 웹 진입점

`packages/web/src/main.tsx`와 `packages/web/src/App.tsx`가 프레젠테이션 조합 루트다.
상태 관리는 `useMonitorStore`, 실시간 동기화는 `useWebSocket`과 `lib/realtime.ts`가 맡는다.

## 패키지 간 책임 분리

### Core는 의미를 정의한다

새 이벤트 종류, lane semantics, runtime adapter capability처럼 시스템 전체가 공유해야 할 의미는
먼저 `@monitor/core`에서 확정해야 한다.

### Server는 lifecycle과 persistence를 책임진다

task/session/event 저장, runtime session binding, evaluation 저장과 검색,
WebSocket notification은 모두 `@monitor/server`가 책임진다.

### MCP는 수동/반자동 에이전트 경로를 연다

Codex 같은 환경에서는 자동 hook이 없으므로 MCP layer가 사실상 관측 어댑터 역할을 한다.

### Web은 read model과 탐색 경험을 책임진다

웹은 서버의 canonical state를 소비해 타임라인, 인스펙터, 워크플로우 라이브러리 경험을 만든다.
도메인 계산 일부는 `lib/insights.ts`, `lib/timeline.ts`에 모여 있다.

## 확장 포인트

- 새 runtime adapter 추가: `@monitor/core` capability registry, server endpoint 사용 전략, guide 문서까지 같이 갱신
- 새 monitoring event 추가: core type, server schema/route/service, MCP registration, web rendering 영향 확인
- 새 read model 추가: server API와 web fetch/store 경로를 함께 설계

## 현재 구조의 강점과 주의점

강점:

- 패키지 경계가 파일 구조와 실제 의존 방향에 잘 드러난다.
- `create-monitor-runtime.ts` 덕분에 서버 조합 경로가 분명하다.
- `core`가 공통 계약을 묶어 주기 때문에 런타임이 여러 개여도 기본 의미가 흐트러지지 않는다.

주의점:

- 웹이 핵심 타입을 `core`로 다시 수렴했지만, search hit나 read-model 인터페이스는 여전히 웹 전용 shape를 가진다.
- `MonitorService`, `App.tsx`, `Timeline.tsx`, `insights.ts` 같은 대형 모듈이 책임을 많이 들고 있다.
- `packages/server/src/infrastructure/monitor-database.ts` 같은 legacy 흔적은 신규 기여자를 혼란스럽게 만든다.

## 관련 문서

- [Core Domain & Event Model](./core-domain-and-event-model.md)
- [Monitor Server](./monitor-server.md)
- [MCP Server](./mcp-server.md)
- [Web Dashboard](./web-dashboard.md)
- [Backend Server](./backend-server.md)
- [Frontend Dashboard](./frontend-dashboard.md)

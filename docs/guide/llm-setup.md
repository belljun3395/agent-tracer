# Agent Tracer - 런타임 설정 맵

외부 프로젝트에 Agent Tracer를 붙이려면 먼저
[external-setup.md](./external-setup.md) 부터 보세요.

런타임 capability 상세는 [runtime-capabilities.md](./runtime-capabilities.md)를 참고하세요.

## 추천 경로

| 런타임 | 외부 설치 자동화 | 기본 통합 방식 | 가이드 |
|--------|------------------|----------------|--------|
| Claude Code | 예 | `setup:external` + Claude plugin 실행 + Claude MCP 등록 | [claude-setup.md](./claude-setup.md) |
| 기타 런타임 | 아니오 | HTTP/MCP 호출 절차를 직접 구성 | [runtime-capabilities.md](./runtime-capabilities.md) |

## 공통 구조

Agent Tracer 통합은 항상 두 조각으로 나뉩니다.

1. **monitor server**
   - 대시보드와 저장소 역할을 합니다.
   - 기본 주소는 `http://127.0.0.1:3847` 입니다.
2. **runtime adapter**
   - 현재 저장소에 구현된 어댑터는 Claude Code plugin 입니다.
   - 다른 런타임은 같은 HTTP/MCP surface를 직접 호출하는 방식으로 붙일 수 있습니다.

## 서버 경계 요약

- Claude plugin 은 `runtime-session-*`, `user-message`, `assistant-response`, tool/explore/todo/agent activity 계열을 자동으로 호출합니다.
- 수동 런타임은 같은 엔드포인트를 직접 호출하면 됩니다.
- 모델별 / 도구별 상세 capability 차이는 runtime capability registry와 각 가이드가 담당합니다.

즉, 외부 사용자는 서버 내부 구현 세부사항보다 자신이 선택한 연결 방식만 맞추면 됩니다.

## Thought-Flow Read Model

서버는 raw event log 외에 대시보드용 observability read model도 함께 제공합니다.

- `GET /api/tasks/:taskId/observability`
  - 선택한 task의 phase breakdown, active duration, session 상태, trace coverage, focus summary
- `GET /api/observability/overview`
  - 전체 task 기준 prompt capture, trace-linked task 비율, stale running task, runtime source summary
- `GET /api/overview`
  - 기존 stats 응답에 `observability` snapshot 포함

웹 대시보드는 이 read model을 사용해 Top bar diagnostics와 Inspector `Flow` / `Health` 탭을 렌더링합니다.
세부 응답 shape과 해석 기준은 [task-observability.md](./task-observability.md)를 참고하세요.

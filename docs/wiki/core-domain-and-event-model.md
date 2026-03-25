# Core Domain & Event Model

`@monitor/core`는 Agent Tracer 전체의 공통 언어를 제공한다.

## 포함 내용

- `TimelineLane`
- `MonitoringEventKind`
- `MonitoringTask`
- `MonitoringSession`
- `TimelineEvent`
- workflow evaluation 관련 타입

## 핵심 파일

- `packages/core/src/domain.ts`
- `packages/core/src/classifier.ts`
- `packages/core/src/action-registry.ts`
- `packages/core/src/runtime-capabilities.ts`

## 핵심 설계 포인트

- 서버, MCP, 웹이 모두 이 계약 위에서 움직인다.
- 따라서 새 이벤트나 메타데이터 필드를 추가할 때 가장 먼저 여기서 의미를 확정해야 한다.

## 유지보수 메모

- 웹 타입 재선언
- MCP 등록부와의 drift
- non-ASCII slug / cross-platform path 같은 경계 문제가 남아 있다

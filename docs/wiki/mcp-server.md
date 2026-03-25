# MCP Server

`@monitor/mcp`는 monitor server의 HTTP API를 에이전트 친화적인 MCP tool 표면으로 바꾼다.
Claude hook처럼 자동 수집이 가능한 경로에도 보조 수단으로 쓰일 수 있고,
Codex처럼 수동 skill 중심 환경에서는 사실상 핵심 어댑터 역할을 한다.

## 핵심 파일

- `packages/mcp/src/index.ts`
- `packages/mcp/src/client.ts`
- `packages/mcp/src/result.ts`
- `packages/mcp/test/client.test.ts`

## 현재 제공 도구 수

현재 `createMonitorMcpServer()`는 24개의 `monitor_*` 도구를 등록한다.
이 도구들은 lifecycle, event logging, semantic flow, workflow library로 나뉜다.

## 동작 방식

1. MCP 클라이언트가 tool을 호출한다.
2. `packages/mcp/src/index.ts`의 handler가 입력 schema를 검증한다.
3. `MonitorClient`가 대응하는 `/api/*` endpoint로 HTTP 요청을 보낸다.
4. 결과는 `toToolResponse()`를 통해 MCP 응답 형식으로 감싸진다.

## 이 레이어가 중요한 이유

### 수동 관측 경로를 표준화한다

모든 에이전트 런타임이 hook이나 plugin을 제공하지는 않는다.
MCP 표면이 있으면 최소한 같은 HTTP 서버를 공통 대상 삼아 수동 모니터링을 할 수 있다.

### 실패를 에이전트 작업 전체 실패로 번지지 않게 한다

`MonitorClient`는 네트워크 오류나 비정상 HTTP 응답을 예외로 던지지 않고
`ok: false` 결과로 돌려준다. 즉, monitor server가 죽어도 에이전트 작업 자체는 계속된다.

### runtime adapter 문서와 연결된다

Claude, OpenCode, Codex 문서에서 언급하는 많은 `monitor_*` 호출이 실제로는 이 패키지에 있다.

## 현재 구조의 특징

- 모든 도구가 한 파일에 수동 등록돼 있다.
- tool name, input schema, target endpoint가 가까이 붙어 있어 읽기에는 쉽다.
- 반면 도구 수가 늘수록 반복 코드와 drift 위험도 같이 커진다.

## 유지보수 관점 체크포인트

- 새 HTTP endpoint를 만들면 MCP surface도 필요한지 확인
- tool input schema와 server request schema가 같은 제약을 가지는지 확인
- runtime 문서에 적힌 tool 이름과 실제 등록 이름이 일치하는지 확인
- `monitor_user_message`, `monitor_assistant_response`, workflow library 도구처럼
  캐노니컬 경로가 있는 기능은 문서와 스킬에서 한 경로로 수렴시키기

## 관련 문서

- [MCP Tool Reference](./mcp-tool-reference.md)
- [MonitorClient & Transport Layer](./monitorclient-and-transport-layer.md)
- [Codex Skill Adapter](./codex-skill-adapter.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)

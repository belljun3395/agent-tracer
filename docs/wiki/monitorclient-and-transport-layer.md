# MonitorClient & Transport Layer

`MonitorClient`는 MCP 도구가 HTTP 서버와 통신할 때 사용하는 transport wrapper다.

## 핵심 파일

- `packages/mcp/src/client.ts`
- `packages/mcp/src/result.ts`

## 현재 역할

- JSON POST 요청 전송
- 성공/실패를 MCP tool 응답 형태로 감싼다

## 유지보수 메모

- 현재는 성공 응답이 항상 JSON이라고 가정하는 경향이 있다
- protocol evolution이나 204/text 응답 같은 경계는 테스트를 더 보강할 필요가 있다

# MonitorClient & Transport Layer

`MonitorClient`는 MCP tool handler가 monitor server와 통신할 때 사용하는 얇은 HTTP wrapper다.
이 레이어의 가장 중요한 목표는 "모니터링 실패가 에이전트 작업 실패가 되지 않게 하는 것"이다.

## 핵심 파일

- `packages/mcp/src/client.ts`
- `packages/mcp/src/result.ts`

## 현재 역할

### `MonitorClient`

- `MONITOR_BASE_URL` 또는 기본값 `http://127.0.0.1:3847`를 사용
- `get()`과 `post()` 제공
- 네트워크 실패나 비정상 응답이 와도 예외를 던지지 않음
- 항상 `SafePostResult` 형태로 반환

### `toToolResponse()`

- `SafePostResult`를 MCP tool 응답 형태로 변환
- `content`에는 짧은 텍스트 메시지
- `structuredContent`에는 전체 결과 객체

## 왜 이렇게 설계했나

monitor server는 보조 시스템이다. 서버가 죽었다고 해서 Claude나 수동 클라이언트의 실제 작업이
멈추면 안 되므로, transport layer가 "best effort" 정책을 강하게 가진다.

이 덕분에 skill/hook/plugin 쪽에서는 아래처럼 단순하게 쓸 수 있다.

- 성공 시: `ok: true`, `message: "monitor event recorded"`
- 실패 시: `ok: false`, `message: "monitor server unavailable; event ignored"`

## 현재 좋은 점

- 호출부가 예외 처리로 복잡해지지 않는다.
- monitor server 미가용 시 gap report 정책과 잘 맞는다.
- 테스트에서 client 주입이 쉬워 MCP server 검증이 간단하다.

## 주의할 점

- 성공 응답이 JSON이라는 가정이 강하다.
- 204 응답이나 text/plain 응답으로 바뀌면 보완이 필요하다.
- 현재는 재시도나 backoff가 없으므로, 일시적 네트워크 오류는 그냥 흘려보낸다.

## 관련 문서

- [MCP Server](./mcp-server.md)
- [HTTP API Reference](./http-api-reference.md)

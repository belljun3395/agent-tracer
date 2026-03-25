# MCP Server

`@monitor/mcp`는 monitor-server HTTP API를 MCP tool surface로 노출한다.

## 핵심 파일

- `packages/mcp/src/index.ts`
- `packages/mcp/src/client.ts`
- `packages/mcp/src/result.ts`

## 현재 역할

- monitoring event를 MCP tool로 기록
- runtime/session lifecycle 도구 제공
- workflow evaluation/search 도구 제공

## 유지보수 메모

- 기능은 명확하지만 등록 파일이 커지고 있다
- shared manifest 없이 수동 등록이라 drift 가능성이 있다

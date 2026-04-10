# MonitorClient & Transport Layer

`MonitorClient` is a thin HTTP wrapper used by MCP tool handlers to communicate with the monitor server.
The most important goal of this layer is "to ensure that monitoring failures do not become agent task failures".

## Core Files

- `packages/mcp/src/client.ts`
- `packages/mcp/src/result.ts`

## Current Role

### `MonitorClient`

- Uses `MONITOR_BASE_URL` or default `http://127.0.0.1:3847`
- Provides `get()` and `post()`
- Does not throw exceptions even if network fails or abnormal response comes
- Always returns in `SafePostResult` form

### `toToolResponse()`

- Converts `SafePostResult` to MCP tool response format
- `content` contains a short text message
- `structuredContent` contains the full result object

## Why This Design

The monitor server is an auxiliary system. If the server dies, the actual work of Claude or manual clients
should not stop, so the transport layer has a strong "best effort" policy.

Because of this, the skill/hook/plugin side can be used simply like this:

- On success: `ok: true`, `message: "monitor event recorded"`
- On failure: `ok: false`, `message: "monitor server unavailable; event ignored"`

## Current Strengths

- Caller side doesn't get complex with exception handling.
- Works well with gap report policy when monitor server is unavailable.
- Easy client injection in tests makes MCP server validation simple.

## Considerations

- Strong assumption that successful responses are JSON.
- If changed to 204 responses or text/plain responses, supplementation is needed.
- Currently no retry or backoff, so transient network errors are silently ignored.

## Related Documentation

- [MCP Server](./mcp-server.md)
- [HTTP API Reference](./http-api-reference.md)

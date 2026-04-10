# MCP Server

`@monitor/mcp` transforms the monitor server's HTTP API into an agent-friendly MCP tool surface.
It can be used as a supplementary method for automatic collection paths like Claude plugins,
and in manual client environments, it serves as a core adapter.

## Core Files

- `packages/mcp/src/index.ts`
- `packages/mcp/src/client.ts`
- `packages/mcp/src/result.ts`
- `packages/mcp/test/client.test.ts`

## Current Number of Tools

Currently `createMonitorMcpServer()` registers 24 `monitor_*` tools.
These tools are divided into lifecycle, event logging, semantic flow, and workflow library.

## How It Works

1. MCP client invokes a tool.
2. The handler in `packages/mcp/src/index.ts` validates input schema.
3. `MonitorClient` sends an HTTP request to the corresponding `/api/*` endpoint.
4. The result is wrapped in MCP response format via `toToolResponse()`.

## Why This Layer Is Important

### Standardizes manual observability paths

Not all agent runtimes provide hooks or plugins.
With an MCP surface, manual monitoring can at least target the same HTTP server.

### Prevents failures from cascading to the entire agent task

`MonitorClient` does not throw exceptions for network errors or abnormal HTTP responses;
instead, it returns `ok: false` results. In other words, even if the monitor server goes down,
the agent task itself continues.

### Connects to runtime adapter documentation

Many `monitor_*` calls mentioned in Claude plugin documentation and manual integration documentation
actually reside in this package.

## Characteristics of the Current Structure

- All tools are manually registered in one file.
- Tool name, input schema, and target endpoint are close together, making it easy to read.
- However, as the number of tools grows, repetitive code and drift risk also increase.

## Maintenance Checkpoints

- When creating a new HTTP endpoint, verify if MCP surface is also needed
- Verify that tool input schema and server request schema have the same constraints
- Verify that tool names in runtime documentation match the actual registered names
- For features with canonical paths like `monitor_user_message`, `monitor_assistant_response`, and workflow library tools,
  converge to a single path in documentation and skills

## Related Documentation

- [MCP Tool Reference](./mcp-tool-reference.md)
- [MonitorClient & Transport Layer](./monitorclient-and-transport-layer.md)
- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)

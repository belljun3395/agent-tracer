/**
 * @module index
 *
 * Agent Tracer MCP stdio 서버.
 * 에이전트(Claude, Codex)가 호출할 수 있도록 모니터링 도구를 등록한다.
 * 현재 기준으로는 24개 MCP 도구를 노출한다.
 * 빌드 산출물(`dist/index.js`) 또는 패키지 바이너리(`monitor-mcp`)로 stdio MCP 서버를 시작한다.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { MonitorClient } from "./client.js";
import {
  registerTaskLifecycleTools,
  registerAsyncLifecycleTools,
  registerEventLoggingTools,
  registerConversationTools,
  registerWorkflowTools
} from "./tools/index.js";

/**
 * 모니터링 툴 핸들러가 등록된 MCP 서버 인스턴스를 생성한다.
 * 테스트에서는 커스텀 `client`를 주입할 수 있다.
 *
 * @param client - HTTP 클라이언트 (기본값: `new MonitorClient()`)
 * @returns 도구가 등록된 {@link McpServer} 인스턴스
 */
export function createMonitorMcpServer(client = new MonitorClient()): McpServer {
  const server = new McpServer({
    name: "monitor-server",
    version: "0.1.0"
  });

  registerTaskLifecycleTools(server, client);
  registerAsyncLifecycleTools(server, client);
  registerEventLoggingTools(server, client);
  registerConversationTools(server, client);
  registerWorkflowTools(server, client);

  return server;
}

/**
 * stdio 트랜스포트로 MCP 서버를 시작한다.
 * 에이전트 런타임이 이 함수를 직접 호출하거나 빌드 산출물(`dist/index.js`)을 직접 실행한다.
 */
export async function startMonitorMcpServer(): Promise<void> {
  const server = createMonitorMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (import.meta.url.endsWith(process.argv[1] ?? "")) {
  await startMonitorMcpServer();
}

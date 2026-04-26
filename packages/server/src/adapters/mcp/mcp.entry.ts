import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MonitorClient } from "./client.js";
import { registerAsyncLifecycleTools } from "~adapters/mcp/tools/async.lifecycle.js";
import { registerConversationTools } from "~adapters/mcp/tools/conversation.js";
import { registerEventLoggingTools } from "~adapters/mcp/tools/event.logging.js";
import { registerTaskLifecycleTools } from "~adapters/mcp/tools/task.lifecycle.js";
export function createMonitorMcpServer(client = new MonitorClient()): McpServer {
    const server = new McpServer({
        name: "monitor-server",
        version: "0.1.0"
    });
    registerTaskLifecycleTools(server, client);
    registerAsyncLifecycleTools(server, client);
    registerEventLoggingTools(server, client);
    registerConversationTools(server, client);
    return server;
}
export async function startMonitorMcpServer(): Promise<void> {
    const server = createMonitorMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
if (import.meta.url.endsWith(process.argv[1] ?? "")) {
    await startMonitorMcpServer();
}

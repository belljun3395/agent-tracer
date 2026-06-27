import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MonitorClient } from "./client.js";
import { registerAsyncLifecycleTools } from "@monitor/run-api/task/mcp/async.lifecycle.js";
import { registerConversationTools } from "@monitor/timeline-api/event/mcp/conversation.js";
import { registerEventLoggingTools } from "@monitor/timeline-api/event/mcp/event.logging.js";
import { registerRecipeTools } from "@monitor/insight-api/recipe/mcp/recipe.js";
import { registerRuleTools } from "@monitor/rules-api/rule/mcp/rule.js";
import { registerTaskLifecycleTools } from "@monitor/run-api/task/mcp/task.lifecycle.js";
export function createMonitorMcpServer(client = new MonitorClient()): McpServer {
    const server = new McpServer({
        name: "monitor-server",
        version: "0.1.0"
    });
    registerTaskLifecycleTools(server, client);
    registerAsyncLifecycleTools(server, client);
    registerEventLoggingTools(server, client);
    registerConversationTools(server, client);
    registerRuleTools(server, client);
    registerRecipeTools(server, client);
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

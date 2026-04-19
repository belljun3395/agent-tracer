import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ASYNC_TASK_STATUSES } from "~domain/index.js";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";
export function registerAsyncLifecycleTools(server: McpServer, client: MonitorClient): void {
    server.registerTool("monitor_async_task", {
        title: "Monitor Async Task",
        description: "Record background task lifecycle events.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            asyncTaskId: z.string(),
            asyncStatus: z.enum(ASYNC_TASK_STATUSES),
            title: z.string().optional(),
            body: z.string().optional(),
            description: z.string().optional(),
            agent: z.string().optional(),
            category: z.string().optional(),
            parentSessionId: z.string().optional(),
            durationMs: z.number().nonnegative().optional(),
            filePaths: z.array(z.string()).optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/ingest/v1/events", { events: [{ kind: "action.logged", ...input }] })));
}

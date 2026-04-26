import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MONITORING_TASK_KINDS, TASK_COMPLETION_REASONS } from "~domain/monitoring/index.js";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";
export function registerTaskLifecycleTools(server: McpServer, client: MonitorClient): void {
    server.registerTool("monitor_task_start", {
        title: "Monitor Task Start",
        description: "Record the start of a monitored agent task.",
        inputSchema: {
            taskId: z.string().optional(),
            title: z.string(),
            workspacePath: z.string().optional(),
            runtimeSource: z.string().optional(),
            summary: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/task-start", input)));
    server.registerTool("monitor_task_complete", {
        title: "Monitor Task Complete",
        description: "Mark a monitored task as completed.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            summary: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/task-complete", input)));
    server.registerTool("monitor_task_link", {
        title: "Monitor Task Link",
        description: "Link an already-started task into parent/background lineage. " +
            "Use this when a runtime discovers subagent or background relationships after task creation.",
        inputSchema: {
            taskId: z.string(),
            title: z.string().optional(),
            taskKind: z.enum(MONITORING_TASK_KINDS).optional(),
            parentTaskId: z.string().optional(),
            parentSessionId: z.string().optional(),
            backgroundTaskId: z.string().optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/task-link", input)));
    server.registerTool("monitor_task_error", {
        title: "Monitor Task Error",
        description: "Record a monitored task failure without interrupting the agent.",
        inputSchema: {
            taskId: z.string(),
            sessionId: z.string().optional(),
            errorMessage: z.string(),
            summary: z.string().optional(),
            metadata: z.record(z.unknown()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/task-error", input)));
    server.registerTool("monitor_runtime_session_ensure", {
        title: "Monitor Runtime Session Ensure",
        description: "Create or resume a runtime-scoped monitor task/session using runtimeSource + runtimeSessionId. " +
            "Use this when the runtime can keep a stable thread/session identity across turns.",
        inputSchema: {
            runtimeSource: z.string(),
            runtimeSessionId: z.string(),
            title: z.string(),
            workspacePath: z.string().optional(),
            parentTaskId: z.string().optional(),
            parentSessionId: z.string().optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/runtime-session-ensure", input)));
    server.registerTool("monitor_runtime_session_end", {
        title: "Monitor Runtime Session End",
        description: "End a runtime-scoped monitor session. " +
            "Use completeTask=true only when the whole work item should be completed, otherwise leave it unset to preserve the task across turns.",
        inputSchema: {
            runtimeSource: z.string(),
            runtimeSessionId: z.string(),
            summary: z.string().optional(),
            completeTask: z.boolean().optional(),
            completionReason: z.enum(TASK_COMPLETION_REASONS).optional(),
            backgroundCompletions: z.array(z.string()).optional()
        }
    }, async (input) => toToolResponse(await client.post("/api/runtime-session-end", input)));
}

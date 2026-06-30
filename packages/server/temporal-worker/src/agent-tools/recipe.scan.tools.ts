import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ITaskSnapshotQuery, TaskSnapshotArchivedScope } from "@monitor/run-api/public/task/iservice/task.snapshot.query.iservice.js";
import type { ITaskSummary } from "@monitor/run-api/public/task/iservice/task.summary.iservice.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";

export const RECIPE_SCAN_MCP_SERVER_NAME = "monitor-recipe-scan";

export const RECIPE_SCAN_MCP_TOOLS = [
    `${RECIPE_SCAN_MCP_SERVER_NAME}__list_tasks`,
    `${RECIPE_SCAN_MCP_SERVER_NAME}__get_task_summary`,
    `${RECIPE_SCAN_MCP_SERVER_NAME}__get_task_events`,
] as const;

export function buildRecipeScanTools(
    taskQuery: ITaskSnapshotQuery,
    taskSummary: ITaskSummary,
    eventRead: ITimelineEventRead,
) {
    return createSdkMcpServer({
        name: RECIPE_SCAN_MCP_SERVER_NAME,
        tools: [
            tool(
                "list_tasks",
                "List tasks with minimal metadata (id, title, status, taskKind, createdAt). Use this first to identify candidate clusters before drilling into summaries.",
                {
                    scope: z.enum(["active", "archived", "all"]).optional().default("active"),
                },
                async ({ scope }) => {
                    const tasks = await taskQuery.findAll((scope ?? "active") as TaskSnapshotArchivedScope);
                    const slim = tasks
                        .filter((t) => t.origin !== "server-sdk")
                        .map((t) => ({
                            id: t.id,
                            title: t.title,
                            status: t.status,
                            taskKind: t.taskKind ?? "primary",
                            createdAt: t.createdAt,
                        }));
                    return { content: [{ type: "text" as const, text: JSON.stringify(slim, null, 2) }] };
                },
            ),
            tool(
                "get_task_summary",
                "Get full task summary: tool usage counts, top files touched, top commands run, first user message. Call this for tasks that look like promising recipe candidates.",
                {
                    taskId: z.string().describe("The task ID"),
                },
                async ({ taskId }) => {
                    const { summary } = await taskSummary.execute({ taskId });
                    if (!summary) {
                        return { content: [{ type: "text" as const, text: `Task ${taskId} not found.` }] };
                    }
                    return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
                },
            ),
            tool(
                "get_task_events",
                "Get the chronological event sequence for a task. Use this when you need to understand the exact step-by-step behavior for a specific task in a cluster.",
                {
                    taskId: z.string().describe("The task ID"),
                    limit: z.number().int().min(1).max(300).optional().describe("Max events to return (default 100)"),
                },
                async ({ taskId, limit = 100 }) => {
                    const events = await eventRead.findByTaskId(taskId);
                    return { content: [{ type: "text" as const, text: JSON.stringify(events.slice(0, limit), null, 2) }] };
                },
            ),
        ],
    });
}

import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { ITaskSummary } from "@monitor/run-api/public/task/iservice/task.summary.iservice.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";
import type { ListRulesUseCase } from "@monitor/rules-api/application/rule/list.rules.usecase.js";

export const RULE_GEN_MCP_SERVER_NAME = "monitor-rule-gen";

export const RULE_GEN_MCP_TOOLS = [
    `${RULE_GEN_MCP_SERVER_NAME}__get_task_summary`,
    `${RULE_GEN_MCP_SERVER_NAME}__get_task_events`,
    `${RULE_GEN_MCP_SERVER_NAME}__list_rules`,
] as const;

export function buildRuleGenerationTools(
    taskSummary: ITaskSummary,
    eventRead: ITimelineEventRead,
    listRules: ListRulesUseCase,
) {
    return createSdkMcpServer({
        name: RULE_GEN_MCP_SERVER_NAME,
        tools: [
            tool(
                "get_task_summary",
                "Get a summary of a task: title, status, workspace path, tool usage counts, top files touched, and top commands run.",
                { taskId: z.string().describe("The task ID") },
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
                "Get the timeline events for a task. Each event has a kind, title, body, and metadata. Use this to understand what the agent did step-by-step.",
                {
                    taskId: z.string().describe("The task ID"),
                    limit: z.number().int().min(1).max(300).optional().describe("Max events to return (default 150)"),
                },
                async ({ taskId, limit = 150 }) => {
                    const events = await eventRead.findByTaskId(taskId);
                    const sliced = events.slice(0, limit);
                    return { content: [{ type: "text" as const, text: JSON.stringify(sliced, null, 2) }] };
                },
            ),
            tool(
                "list_rules",
                "List existing rules to avoid generating duplicates. Returns rule names and triggers.",
                {
                    scope: z.enum(["global", "task"]).optional().default("global").describe("Rule scope to query"),
                },
                async ({ scope }) => {
                    const { rules } = await listRules.execute({ scope: scope ?? "global" });
                    const slim = rules.map((r) => ({ name: r.name, trigger: r.trigger ?? null }));
                    return { content: [{ type: "text" as const, text: JSON.stringify(slim, null, 2) }] };
                },
            ),
        ],
    });
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { WORKFLOW_RATINGS } from "~domain/index.js";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";
export function registerWorkflowTools(server: McpServer, client: MonitorClient): void {
    server.registerTool("monitor_evaluate_task", {
        title: "Monitor Evaluate Task",
        description: "Save a completed task to the workflow library as a reusable example. " +
            "You will receive a prompt that includes task context and the user's partial assessment. " +
            "Use the user's assessment as the primary basis and fill any empty fields by reasoning over the task context. " +
            "rating='good' means the approach worked well and should be referenced later; rating='skip' excludes it. " +
            "Always fill outcomeNote, approachNote, reuseWhen, and watchouts — infer from context if the user left them empty.",
        inputSchema: {
            taskId: z.string(),
            rating: z.enum(WORKFLOW_RATINGS),
            useCase: z.string().optional().describe("What kind of task was this? e.g. 'TypeScript type error fixes'"),
            workflowTags: z.array(z.string()).optional().describe("e.g. ['typescript', 'bug-fix', 'refactor']"),
            outcomeNote: z.string().optional().describe("What was achieved or resolved?"),
            approachNote: z.string().optional().describe("What approach worked well and why?"),
            reuseWhen: z.string().optional().describe("When should this workflow be reused?"),
            watchouts: z.string().optional().describe("What should future runs watch out for?")
        }
    }, async ({ taskId, ...rest }) => toToolResponse(await client.post(`/ingest/v1/tasks/${taskId}/evaluate`, rest)));
    server.registerTool("monitor_find_similar_workflows", {
        title: "Monitor Find Similar Workflows",
        description: "Search past workflow examples to find how similar tasks were handled. " +
            "Call this at the start of a new task to get hints from past similar work. " +
            "Returns workflow summaries including what was done and what approach worked.",
        inputSchema: {
            description: z.string().describe("Describe the current task to search for similar past work"),
            tags: z.array(z.string()).optional().describe("Filter by tags e.g. ['typescript', 'refactor']"),
            limit: z.number().int().min(1).max(10).optional().default(3)
        }
    }, async ({ description, tags, limit }) => {
        const params = new URLSearchParams({ q: description, limit: String(limit) });
        if (tags && tags.length > 0)
            params.set("tags", tags.join(","));
        const result = await client.get(`/ingest/v1/workflows/similar?${params.toString()}`);
        if (!result.ok || !Array.isArray(result.data)) {
            return toToolResponse(result);
        }
        const items = result.data as Array<{
            taskId: string;
            title: string;
            rating: string;
            useCase: string | null;
            workflowTags: string[];
            outcomeNote: string | null;
            approachNote: string | null;
            reuseWhen: string | null;
            watchouts: string | null;
            eventCount: number;
            workflowContext: string;
        }>;
        if (items.length === 0) {
            return { content: [{ type: "text" as const, text: "No similar past workflows found." }], structuredContent: result };
        }
        const text = items.map((item, i) => [
            `--- [${i + 1}] ${item.title} (${item.rating})`,
            item.useCase ? `Use case: ${item.useCase}` : null,
            item.workflowTags.length > 0 ? `Tags: ${item.workflowTags.join(", ")}` : null,
            item.outcomeNote ? `Outcome: ${item.outcomeNote}` : null,
            item.approachNote ? `What worked: ${item.approachNote}` : null,
            item.reuseWhen ? `Reuse when: ${item.reuseWhen}` : null,
            item.watchouts ? `Watch out: ${item.watchouts}` : null,
            "",
            item.workflowContext
        ].filter(Boolean).join("\n")).join("\n\n");
        return { content: [{ type: "text" as const, text }], structuredContent: result };
    });
}

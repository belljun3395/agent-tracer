import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";

export function registerSuggestRuleTool(server: McpServer, client: MonitorClient): void {
    server.registerTool(
        "monitor_suggest_rule",
        {
            title: "Monitor Suggest Rule",
            description:
                "Propose a verification rule for the current task. The rule is registered " +
                "as a task-scoped Rule and immediately participates in verification for " +
                "future turns of this task. Use this after completing a turn when you " +
                "notice a claim pattern worth verifying (e.g. 'ran tests' should be " +
                "backed by a Bash call). taskId is required — pass the current task's id.",
            inputSchema: {
                trigger: z.object({ phrases: z.array(z.string()).min(1) }).optional(),
                triggerOn: z.enum(["assistant", "user"]).optional(),
                expect: z.object({
                    tool: z.string().optional(),
                    commandMatches: z.array(z.string()).optional(),
                    pattern: z.string().optional(),
                }),
                rationale: z.string(),
                severity: z.enum(["info", "warn", "block"]).optional(),
                name: z.string().optional(),
                taskId: z.string(),
            },
        },
        async (input) =>
            toToolResponse(await client.post("/ingest/v1/rules/suggestions", input)),
    );
}

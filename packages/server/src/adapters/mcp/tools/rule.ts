import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
    RULE_EXPECTED_ACTIONS,
    RULE_SCOPES,
    RULE_SEVERITIES,
    RULE_SOURCES,
    RULE_TRIGGER_SOURCES,
} from "@monitor/governance/rule/domain/const/rule.const.js";
import type { MonitorClient } from "../client.js";
import { toToolResponse } from "../result.js";

export function registerRuleTools(server: McpServer, client: MonitorClient): void {
    server.registerTool(
        "monitor_create_rule",
        {
            title: "Monitor Create Rule (Agent Suggestion)",
            description:
                "Register an agent-suggested verification rule. Source is set to 'agent' and " +
                "the result is idempotent via signature dedup: if a non-deleted rule with the " +
                "same trigger+expect signature already exists, that rule is returned with " +
                "created=false (no duplicate is inserted). " +
                "Use scope='global' for repo-wide rules, or scope='task' with taskId for one-off. " +
                "expect.action is the high-level action category (command|file-read|file-write|web), " +
                "not a tool name; combine with expect.commandMatches (substring on shell command) " +
                "and/or expect.pattern (regex on filePath or command) to be specific.",
            inputSchema: {
                name: z.string().min(1),
                trigger: z
                    .object({ phrases: z.array(z.string().min(1)).min(1) })
                    .optional(),
                triggerOn: z.enum(RULE_TRIGGER_SOURCES).optional(),
                expect: z.object({
                    action: z.enum(RULE_EXPECTED_ACTIONS).optional(),
                    commandMatches: z.array(z.string().min(1)).min(1).optional(),
                    pattern: z.string().min(1).optional(),
                }),
                scope: z.enum(RULE_SCOPES),
                taskId: z.string().min(1).optional(),
                severity: z.enum(RULE_SEVERITIES).optional(),
                rationale: z.string().min(1).optional(),
            },
        },
        async (input) =>
            toToolResponse(await client.post("/ingest/v1/rules/suggestions", input)),
    );

    server.registerTool(
        "monitor_list_rules",
        {
            title: "Monitor List Rules",
            description:
                "List existing verification rules. Use this before monitor_create_rule to avoid " +
                "proposing rules that already exist. Returns { rules: [...] } with each rule's " +
                "signature so the caller can dedup by content.",
            inputSchema: {
                scope: z.enum(RULE_SCOPES).optional(),
                taskId: z.string().min(1).optional(),
                source: z.enum(RULE_SOURCES).optional(),
            },
        },
        async (input) => {
            const params = new URLSearchParams();
            if (input.scope) params.set("scope", input.scope);
            if (input.taskId) params.set("taskId", input.taskId);
            if (input.source) params.set("source", input.source);
            const qs = params.toString();
            const path = qs ? `/ingest/v1/rules?${qs}` : "/ingest/v1/rules";
            return toToolResponse(await client.get(path));
        },
    );

    server.registerTool(
        "monitor_list_tasks",
        {
            title: "Monitor List Tasks",
            description:
                "List monitored tasks (lightweight — no timeline). Use this when you need to " +
                "discover a taskId or browse recent activity. Each item includes id, title, " +
                "status, workspacePath, and timestamps.",
            inputSchema: {},
        },
        async () => toToolResponse(await client.get("/ingest/v1/tasks")),
    );

    server.registerTool(
        "monitor_get_task_summary",
        {
            title: "Monitor Get Task Summary",
            description:
                "Get a compact summary of a task suitable for prompting an LLM agent. Returns " +
                "title, status, workspacePath, the first user.message, eventCount, toolCounts " +
                "(by tool name), topFiles (top 5 by touch count), and topCommands (top 10). " +
                "The summary is bounded in size; do not use this when you need the full timeline.",
            inputSchema: {
                taskId: z.string().min(1),
            },
        },
        async (input) =>
            toToolResponse(
                await client.get(`/ingest/v1/tasks/${encodeURIComponent(input.taskId)}/summary`),
            ),
    );
}

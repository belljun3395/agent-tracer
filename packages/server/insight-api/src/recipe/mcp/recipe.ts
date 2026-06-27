import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { MonitorClient } from "@monitor/shared/mcp/client.js";
import { toToolResponse } from "@monitor/shared/mcp/result.js";
import {
    RECIPE_SCAN_ARCHIVED_SCOPES,
    RECIPE_SCAN_STATUS_FILTERS,
} from "../domain/recipe.scan.filters.js";
import { RECIPE_STATUSES } from "../domain/recipe.entity.js";

const RECIPE_MCP_STATUS_FILTERS = [...RECIPE_STATUSES, "all"] as const;

export function registerRecipeTools(
    server: McpServer,
    client: MonitorClient,
): void {
    server.registerTool(
        "monitor_list_recipes",
        {
            title: "Monitor List Recipes",
            description:
                "List active (or archived) recipes — reusable patterns distilled from past " +
                "task sessions. Each recipe has a title, intent, description, summary_md, " +
                "and applied/success counts. Use this to surface relevant past patterns to " +
                "the user, or to dedup before suggesting new recipes.",
            inputSchema: {
                status: z
                    .enum(RECIPE_MCP_STATUS_FILTERS)
                    .optional(),
            },
        },
        async (input) => {
            const params = new URLSearchParams();
            if (input.status) params.set("status", input.status);
            const qs = params.toString();
            const path = qs ? `/api/v1/recipes?${qs}` : "/api/v1/recipes";
            return toToolResponse(await client.get(path));
        },
    );

    server.registerTool(
        "monitor_list_recipe_candidates",
        {
            title: "Monitor List Recipe Candidates",
            description:
                "List recipe candidates that the LLM proposed but the user hasn't accepted " +
                "or dismissed yet. Use this when the user asks 'what recipes are pending review?'",
            inputSchema: {
                status: z.enum(["pending", "all"]).optional(),
            },
        },
        async (input) => {
            const params = new URLSearchParams();
            if (input.status) params.set("status", input.status);
            const qs = params.toString();
            const path = qs
                ? `/api/v1/recipes/candidates?${qs}`
                : "/api/v1/recipes/candidates";
            return toToolResponse(await client.get(path));
        },
    );

    server.registerTool(
        "monitor_match_recipes",
        {
            title: "Monitor Match Recipes",
            description:
                "Find recipes similar to a given prompt. Returns up to `limit` matches with " +
                "score in [0,1]. Pass `taskId` to record the match as a recipe_application " +
                "row on that task (do NOT pass taskId if just previewing).",
            inputSchema: {
                prompt: z.string().min(1),
                taskId: z.string().min(1).optional(),
                limit: z.number().int().min(1).max(10).optional(),
                injectedVia: z.enum(["auto", "slash_command", "manual"]).optional(),
                dryRun: z.boolean().optional(),
            },
        },
        async (input) =>
            toToolResponse(await client.post("/api/v1/recipes/match", input)),
    );

    server.registerTool(
        "monitor_scan_recipes",
        {
            title: "Monitor Scan Recipes",
            description:
                "Trigger a recipe scan job over the task list. Returns { jobId, status }. " +
                "The job runs asynchronously; poll the recipes UI or list candidates after a " +
                "few seconds to see results.",
            inputSchema: {
                statusFilter: z
                    .enum(RECIPE_SCAN_STATUS_FILTERS)
                    .optional(),
                since: z.string().datetime({ offset: true }).optional(),
                maxCandidates: z.number().int().min(1).max(30).optional(),
                minEventCount: z.number().int().min(1).max(1000).optional(),
                archivedScope: z
                    .enum(RECIPE_SCAN_ARCHIVED_SCOPES)
                    .optional(),
            },
        },
        async (input) =>
            toToolResponse(await client.post("/api/v1/recipes/scan", input)),
    );

    server.registerTool(
        "monitor_recipe_file_affinity",
        {
            title: "Monitor Recipe File Affinity",
            description:
                "Look up files frequently touched for a given intent label (drawn from " +
                "accepted recipes). Pass `intent` to list top files by open_count, or pass " +
                "`path` to list intents that involve a specific file.",
            inputSchema: {
                intent: z.string().min(1).optional(),
                path: z.string().min(1).optional(),
                limit: z.number().int().min(1).max(50).optional(),
            },
        },
        async (input) => {
            const params = new URLSearchParams();
            if (input.intent) params.set("intent", input.intent);
            if (input.path) params.set("path", input.path);
            if (input.limit !== undefined)
                params.set("limit", String(input.limit));
            const qs = params.toString();
            return toToolResponse(
                await client.get(`/api/v1/recipes/file-affinity?${qs}`),
            );
        },
    );
}

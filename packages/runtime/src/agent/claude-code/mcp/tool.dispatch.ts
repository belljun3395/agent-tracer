import {
    createMemoViaDaemon,
    reportRecipeOutcomeViaDaemon,
    requestRecipeScanViaDaemon,
    searchMemosViaDaemon,
    searchRecipesViaDaemon,
    setTaskTitleViaDaemon,
} from "~runtime/daemon/ipc/mcp.client.js";
import {ensureDaemonRunning} from "~runtime/daemon/ipc/hook.client.js";
import type {RecipeMatch} from "~runtime/domain/recipe/model/recipe.model.js";
import {
    CREATE_MEMO_TOOL,
    parseCreateMemoArgs,
} from "~runtime/domain/memo/model/create.memo.tool.model.js";
import {
    SEARCH_MEMOS_TOOL,
    parseSearchMemosArgs,
} from "~runtime/domain/memo/model/search.memos.tool.model.js";
import type {MemoSearchResultItem} from "~runtime/domain/memo/port/memo.search.port.js";
import {
    REPORT_RECIPE_OUTCOME_TOOL,
    parseReportRecipeOutcomeArgs,
} from "~runtime/domain/recipe/model/report.recipe.outcome.tool.model.js";
import {REQUEST_RECIPE_SCAN_TOOL} from "~runtime/domain/recipe/model/request.recipe.scan.tool.model.js";
import {
    SEARCH_RECIPES_TOOL,
    parseSearchRecipesArgs,
} from "~runtime/domain/recipe/model/search.recipes.tool.model.js";
import {
    SET_TASK_TITLE_TOOL,
    parseSetTaskTitleArgs,
} from "~runtime/domain/session/model/set.task.title.tool.model.js";
import type {McpToolSpec} from "~runtime/support/mcp.tool.js";

/** MCP tools/list가 광고하는 도구 전부다. */
export const MCP_TOOLS: readonly McpToolSpec[] = [
    SEARCH_RECIPES_TOOL,
    REPORT_RECIPE_OUTCOME_TOOL,
    REQUEST_RECIPE_SCAN_TOOL,
    SET_TASK_TITLE_TOOL,
    CREATE_MEMO_TOOL,
    SEARCH_MEMOS_TOOL,
];

export interface ToolCallResult {
    readonly text: string;
    readonly isError: boolean;
}

function invalidArgs(): ToolCallResult {
    return {text: "Invalid arguments.", isError: true};
}

function formatSearchResult(matches: readonly RecipeMatch[]): string {
    if (matches.length === 0) return "No matching recipes found in this workspace.";
    return matches
        .map((match) => (
            `## ${match.title} (recipeId: ${match.recipeId}, score ${match.score.toFixed(2)})\n`
            + `intent: ${match.intent}\n${match.description}\n\n${match.summaryMd}`
        ))
        .join("\n\n---\n\n");
}

function formatMemoSearchResult(items: readonly MemoSearchResultItem[]): string {
    if (items.length === 0) return "No memos found on the active task.";
    return items
        .map((item) => `## memo ${item.id} (author: ${item.author}${item.eventId ? `, event: ${item.eventId}` : ""})\n${item.body}`)
        .join("\n\n---\n\n");
}

/** tools/call이 넘긴 도구 이름과 인자를 실제 처리로 위임하고 사람이 읽을 결과 텍스트를 만든다. */
export async function callTool(name: string, args: unknown): Promise<ToolCallResult> {
    await ensureDaemonRunning();
    switch (name) {
        case SEARCH_RECIPES_TOOL.name: {
            const parsed = parseSearchRecipesArgs(args);
            if (!parsed) return invalidArgs();
            const {matches} = await searchRecipesViaDaemon(parsed.query, parsed.limit);
            return {text: formatSearchResult(matches), isError: false};
        }
        case REPORT_RECIPE_OUTCOME_TOOL.name: {
            const parsed = parseReportRecipeOutcomeArgs(args);
            if (!parsed) return invalidArgs();
            const result = await reportRecipeOutcomeViaDaemon(parsed.recipeId, parsed.outcome, parsed.note);
            return result.ok
                ? {text: "Outcome recorded.", isError: false}
                : {text: `Could not record outcome${result.reason ? ` (${result.reason})` : ""}.`, isError: true};
        }
        case REQUEST_RECIPE_SCAN_TOOL.name: {
            const result = await requestRecipeScanViaDaemon();
            return result.queued
                ? {text: "Recipe scan queued.", isError: false}
                : {text: `Scan not queued${result.reason ? ` (${result.reason})` : ""}.`, isError: true};
        }
        case SET_TASK_TITLE_TOOL.name: {
            const parsed = parseSetTaskTitleArgs(args);
            if (!parsed) return invalidArgs();
            const result = await setTaskTitleViaDaemon(parsed.title, parsed.sessionId);
            return result.ok
                ? {text: "Task title updated.", isError: false}
                : {text: `Could not update title${result.reason ? ` (${result.reason})` : ""}.`, isError: true};
        }
        case CREATE_MEMO_TOOL.name: {
            const parsed = parseCreateMemoArgs(args);
            if (!parsed) return invalidArgs();
            const result = await createMemoViaDaemon(parsed.body, parsed.eventId);
            return result.ok
                ? {text: "Memo saved.", isError: false}
                : {text: `Could not save memo${result.reason ? ` (${result.reason})` : ""}.`, isError: true};
        }
        case SEARCH_MEMOS_TOOL.name: {
            const parsed = parseSearchMemosArgs(args);
            if (!parsed) return invalidArgs();
            const result = await searchMemosViaDaemon(parsed.query, parsed.limit);
            return {text: formatMemoSearchResult(result.items), isError: false};
        }
        default:
            return {text: `Unknown tool: ${name}`, isError: true};
    }
}

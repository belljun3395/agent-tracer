import * as path from "node:path";
import {KIND, LANE, provenEvidence} from "~runtime/domain/ingest/model/event.model.js";
import {toOptionalNumber} from "~runtime/domain/ingest/model/file.target.model.js";
import {captureToolResultBody} from "~runtime/domain/ingest/model/tool.capture.model.js";
import {
    sanitizeToolInput,
    toolUseIdOf,
    type ShapedToolEvent,
    type ToolCall,
    type ToolShapeContext,
} from "~runtime/domain/ingest/model/tool.call.model.js";
import type {ToolUsedMetadata} from "~runtime/domain/ingest/model/tool.metadata.model.js";
import {buildSemanticMetadata, inferExploreSemantic} from "~runtime/domain/ingest/model/tool.semantic.model.js";
import {relativeProjectPath} from "~runtime/domain/ingest/model/workspace.path.model.js";
import {toBoolean, toTrimmedString, truncate} from "~runtime/support/text.js";

const MAX_PATH_LENGTH = 300;

export const EXPLORE_TOOLS = ["Read", "Glob", "Grep", "WebFetch", "WebSearch"] as const;
type ExploreTool = (typeof EXPLORE_TOOLS)[number];

interface ExploreShape {
    readonly title: string;
    readonly body: string;
    readonly filePaths: readonly string[];
    readonly extras: Record<string, unknown>;
}

/** Read·Glob·Grep·WebFetch·WebSearch를 탐색 이벤트로 만든다. */
export function shapeExploreTool(call: ToolCall, context: ToolShapeContext): ShapedToolEvent {
    const toolName = call.toolName as ExploreTool;
    const shape = shapeOf(toolName, call, context);
    const isWebTool = toolName === "WebSearch" || toolName === "WebFetch";
    const queryOrUrl = isWebTool
        ? toTrimmedString(call.toolInput["query"]) || toTrimmedString(call.toolInput["url"])
        : "";
    const entityName = shape.filePaths[0];

    const semantic = inferExploreSemantic(toolName, {
        ...(entityName ? {entityName} : {}),
        ...(queryOrUrl ? {queryOrUrl} : {}),
    });
    const captured = captureToolResultBody(call.toolResponse, {
        matchCounter: (raw, text) => exploreMatchCount(toolName, raw, text),
    });

    const metadata: ToolUsedMetadata = {
        ...buildSemanticMetadata(semantic),
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        toolName,
        toolInput: sanitizeToolInput(call.toolInput),
        ...shape.extras,
        ...(isWebTool && queryOrUrl ? {webUrls: [truncate(queryOrUrl, MAX_PATH_LENGTH)]} : {}),
        ...toolUseIdOf(call),
        ...captured,
    };

    return {
        kind: KIND.executeTool,
        lane: LANE.exploration,
        title: shape.title,
        body: shape.body,
        filePaths: shape.filePaths.map((filePath) => truncate(filePath, MAX_PATH_LENGTH)),
        metadata,
    };
}

/** LSP 심볼 조회를 코드 인텔리전스 탐색 이벤트로 만든다. */
export function shapeLspTool(call: ToolCall, context: ToolShapeContext): ShapedToolEvent {
    const operation = toTrimmedString(call.toolInput["operation"]) || "lsp";
    const filePath = toTrimmedString(call.toolInput["file_path"]);
    const symbol = toTrimmedString(call.toolInput["symbol"]);
    const relPath = filePath ? relativeProjectPath(context.projectDir, filePath) : "";
    const titleSuffix = symbol || relPath;

    const metadata: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the LSP PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "grep_code",
            subtypeLabel: `LSP ${operation}`,
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: `lsp_${operation}`,
            entityType: symbol ? "symbol" : "file",
            ...(symbol ? {entityName: symbol} : relPath ? {entityName: relPath} : {}),
            sourceTool: "LSP",
        }),
        toolName: "LSP",
        toolInput: sanitizeToolInput(call.toolInput),
        ...(filePath ? {filePath, relPath} : {}),
        ...toolUseIdOf(call),
    };

    return {
        kind: KIND.executeTool,
        lane: LANE.exploration,
        title: `LSP ${operation}${titleSuffix ? `: ${truncate(titleSuffix, 60)}` : ""}`,
        body: `LSP ${operation}${relPath ? ` in ${relPath}` : ""}${symbol ? ` for ${symbol}` : ""}`,
        ...(filePath ? {filePaths: [filePath]} : {}),
        metadata,
    };
}

/** 지연 도구 검색을 탐색 이벤트로 만든다. */
export function shapeToolSearch(call: ToolCall): ShapedToolEvent {
    const query = toTrimmedString(call.toolInput["query"]);

    const metadata: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the ToolSearch PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "list_files",
            subtypeLabel: "Tool search",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "query",
            ...(query ? {entityName: query} : {}),
            sourceTool: "ToolSearch",
        }),
        toolName: "ToolSearch",
        ...toolUseIdOf(call),
    };

    return {
        kind: KIND.executeTool,
        lane: LANE.exploration,
        title: query ? `ToolSearch: ${truncate(query, 60)}` : "ToolSearch",
        body: query ? `Searched deferred tools for: ${query}` : "Listed deferred tools",
        metadata,
    };
}

function shapeOf(toolName: ExploreTool, call: ToolCall, context: ToolShapeContext): ExploreShape {
    if (toolName === "Read") return shapeRead(call, context);
    if (toolName === "Glob") return shapeGlob(call, context);
    if (toolName === "Grep") return shapeGrep(call, context);
    return shapeWeb(toolName, call);
}

function shapeRead(call: ToolCall, context: ToolShapeContext): ExploreShape {
    const filePath = toTrimmedString(call.toolInput["file_path"]);
    const relPath = relativeProjectPath(context.projectDir, filePath);
    const offset = toOptionalNumber(call.toolInput["offset"]);
    const limit = toOptionalNumber(call.toolInput["limit"]);
    const rangeSuffix = offset !== undefined || limit !== undefined
        ? ` (lines ${offset ?? 1}${limit ? `–${(offset ?? 1) + limit - 1}` : "+"})`
        : "";
    return {
        title: `Read: ${path.basename(relPath)}${rangeSuffix}`,
        body: `Reading ${relPath}${rangeSuffix}`,
        filePaths: filePath ? [filePath] : [],
        extras: {
            ...(offset !== undefined ? {readOffset: offset} : {}),
            ...(limit !== undefined ? {readLimit: limit} : {}),
        },
    };
}

function shapeGlob(call: ToolCall, context: ToolShapeContext): ExploreShape {
    const pattern = toTrimmedString(call.toolInput["pattern"]);
    const searchPath = toTrimmedString(call.toolInput["path"]);
    const relPath = searchPath ? relativeProjectPath(context.projectDir, searchPath) : "";
    return {
        title: `Glob: ${pattern}`,
        body: `Searching for files matching: ${pattern}${relPath ? ` in ${relPath}` : ""}`,
        filePaths: searchPath ? [searchPath] : [],
        extras: {
            ...(pattern ? {searchPattern: pattern} : {}),
            ...(searchPath ? {searchPath} : {}),
        },
    };
}

function shapeGrep(call: ToolCall, context: ToolShapeContext): ExploreShape {
    const pattern = toTrimmedString(call.toolInput["pattern"]);
    const searchPath = toTrimmedString(call.toolInput["path"]);
    const relPath = searchPath ? relativeProjectPath(context.projectDir, searchPath) : "";
    const glob = toTrimmedString(call.toolInput["glob"]);
    const outputMode = normalizeOutputMode(call.toolInput["output_mode"]);
    const modeBadge = outputMode === "content" ? " [content]" : outputMode === "count" ? " [count]" : "";
    return {
        title: `Grep: ${truncate(pattern, 60)}${modeBadge}`,
        body: `Searching for '${pattern}'${relPath ? ` in ${relPath}` : ""}${glob ? ` (glob ${glob})` : ""}`,
        filePaths: searchPath ? [searchPath] : [],
        extras: {
            ...(pattern ? {searchPattern: pattern} : {}),
            ...(searchPath ? {searchPath} : {}),
            ...(glob ? {searchGlob: glob} : {}),
            ...(outputMode ? {grepOutputMode: outputMode} : {}),
            ...(toBoolean(call.toolInput["-i"]) ? {grepCaseInsensitive: true} : {}),
            ...(toBoolean(call.toolInput["multiline"]) ? {grepMultiline: true} : {}),
        },
    };
}

function shapeWeb(toolName: ExploreTool, call: ToolCall): ExploreShape {
    const query = toTrimmedString(call.toolInput["query"]) || toTrimmedString(call.toolInput["url"]);
    const webPrompt = toTrimmedString(call.toolInput["prompt"], 400);
    const allowedDomains = toStringArray(call.toolInput["allowed_domains"]);
    const blockedDomains = toStringArray(call.toolInput["blocked_domains"]);
    return {
        title: `${toolName}: ${truncate(query, 60)}`,
        body: `Web lookup: ${query}${webPrompt ? `\nPrompt: ${webPrompt}` : ""}`,
        filePaths: [],
        extras: {
            ...(query ? {webQuery: truncate(query, MAX_PATH_LENGTH)} : {}),
            ...(webPrompt ? {webPrompt} : {}),
            ...(allowedDomains ? {webAllowedDomains: allowedDomains} : {}),
            ...(blockedDomains ? {webBlockedDomains: blockedDomains} : {}),
        },
    };
}

function normalizeOutputMode(value: unknown): "content" | "files_with_matches" | "count" | undefined {
    const normalized = toTrimmedString(value).toLowerCase();
    if (normalized === "content" || normalized === "files_with_matches" || normalized === "count") return normalized;
    return undefined;
}

function toStringArray(value: unknown): readonly string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const items = value.map((entry) => toTrimmedString(entry)).filter((entry) => entry.length > 0);
    return items.length > 0 ? items : undefined;
}

function exploreMatchCount(toolName: ExploreTool, raw: unknown, text: string): number | undefined {
    if (toolName === "Grep") return countLines(text);
    if (toolName === "Glob") return Array.isArray(raw) ? raw.length : countLines(text);
    if (toolName === "WebSearch") return Array.isArray(raw) ? raw.length : undefined;
    return undefined;
}

function countLines(text: string): number {
    if (!text.trim()) return 0;
    return text.split("\n").filter((line) => line.length > 0).length;
}

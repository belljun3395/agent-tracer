/**
 * Shared exploration-tool PostToolUse builder used by Read, Glob, Grep,
 * WebFetch, and WebSearch. AskUserQuestion and ExitPlanMode also enter here,
 * but they are mapped to product-level question/plan events instead of generic
 * tool.used exploration cards. Each tool has its own file to honour the
 * "PascalCase = official tool" convention.
 *
 * Tool input fields per official docs:
 *   Read:       file_path, offset?, limit?
 *   Glob:       pattern, path?
 *   Grep:       pattern, path?, glob?, output_mode?, "-i"?, multiline?
 *   WebSearch:  query, allowed_domains?, blocked_domains?
 *   WebFetch:   url, prompt
 */
import * as path from "node:path";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {createMessageId, toBoolean, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent} from "./_shared.js";
import type {PostToolUseHandlerArgs} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ToolUsedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferExploreSemantic } from "~shared/semantics/inference.explore.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

const MAX_PATH_LENGTH = 300;

type ExploreTool = "Read" | "Glob" | "Grep" | "WebFetch" | "WebSearch" | "AskUserQuestion" | "ExitPlanMode";

function toOptionalNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return undefined;
}

function toOptionalStringArray(value: unknown): readonly string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const items = value
        .map((v) => toTrimmedString(v))
        .filter((s): s is string => Boolean(s));
    return items.length > 0 ? items : undefined;
}

function normalizeOutputMode(value: unknown): "content" | "files_with_matches" | "count" | undefined {
    const v = toTrimmedString(value).toLowerCase();
    if (v === "content" || v === "files_with_matches" || v === "count") return v;
    return undefined;
}

export async function postExploreToolEvent(
    {payload, ids}: PostToolUseHandlerArgs,
): Promise<void> {
    const toolName = payload.toolName as ExploreTool;
    if (toolName === "AskUserQuestion") {
        await postQuestionToolEvent({payload, ids});
        return;
    }
    if (toolName === "ExitPlanMode") {
        await postPlanToolEvent({payload, ids});
        return;
    }

    let title = `Explore: ${toolName}`;
    let body = `Used ${toolName} to explore`;
    let filePaths: string[] = [];

    // Extras differ per tool — accumulate then spread into ToolUsedMetadata.
    const extras: Record<string, unknown> = {};

    if (toolName === "Read") {
        const filePath = toTrimmedString(payload.toolInput["file_path"]);
        const relPath = relativeProjectPath(filePath);
        const offset = toOptionalNumber(payload.toolInput["offset"]);
        const limit = toOptionalNumber(payload.toolInput["limit"]);
        const rangeSuffix =
            offset !== undefined || limit !== undefined
                ? ` (lines ${offset ?? 1}${limit ? `–${(offset ?? 1) + limit - 1}` : "+"})`
                : "";
        title = `Read: ${path.basename(relPath)}${rangeSuffix}`;
        body = `Reading ${relPath}${rangeSuffix}`;
        filePaths = filePath ? [filePath] : [];
        if (offset !== undefined) extras.readOffset = offset;
        if (limit !== undefined) extras.readLimit = limit;
    } else if (toolName === "Glob") {
        const pattern = toTrimmedString(payload.toolInput["pattern"]);
        const searchPath = toTrimmedString(payload.toolInput["path"]);
        const relPath = searchPath ? relativeProjectPath(searchPath) : "";
        title = `Glob: ${pattern}`;
        body = `Searching for files matching: ${pattern}${relPath ? ` in ${relPath}` : ""}`;
        if (pattern) extras.searchPattern = pattern;
        if (searchPath) extras.searchPath = searchPath;
        if (searchPath) filePaths = [searchPath];
    } else if (toolName === "Grep") {
        const pattern = toTrimmedString(payload.toolInput["pattern"]);
        const searchPath = toTrimmedString(payload.toolInput["path"]);
        const relPath = searchPath ? relativeProjectPath(searchPath) : "";
        const glob = toTrimmedString(payload.toolInput["glob"]);
        const outputMode = normalizeOutputMode(payload.toolInput["output_mode"]);
        const caseInsensitive = toBoolean(payload.toolInput["-i"]);
        const multiline = toBoolean(payload.toolInput["multiline"]);
        const modeBadge = outputMode === "content" ? " [content]"
            : outputMode === "count" ? " [count]"
            : "";
        title = `Grep: ${pattern.slice(0, 60)}${modeBadge}`;
        body = `Searching for '${pattern}'${relPath ? ` in ${relPath}` : ""}${glob ? ` (glob ${glob})` : ""}`;
        filePaths = searchPath ? [searchPath] : [];
        if (pattern) extras.searchPattern = pattern;
        if (searchPath) extras.searchPath = searchPath;
        if (glob) extras.searchGlob = glob;
        if (outputMode) extras.grepOutputMode = outputMode;
        if (caseInsensitive) extras.grepCaseInsensitive = true;
        if (multiline) extras.grepMultiline = true;
    } else {
        // WebSearch / WebFetch
        const query = toTrimmedString(payload.toolInput["query"]) || toTrimmedString(payload.toolInput["url"]);
        const webPrompt = toTrimmedString(payload.toolInput["prompt"], 400);
        const allowedDomains = toOptionalStringArray(payload.toolInput["allowed_domains"]);
        const blockedDomains = toOptionalStringArray(payload.toolInput["blocked_domains"]);
        title = `${toolName}: ${query.slice(0, 60)}`;
        body = `Web lookup: ${query}${webPrompt ? `\nPrompt: ${webPrompt}` : ""}`;
        if (query) extras.webQuery = query.slice(0, MAX_PATH_LENGTH);
        if (webPrompt) extras.webPrompt = webPrompt;
        if (allowedDomains) extras.webAllowedDomains = allowedDomains;
        if (blockedDomains) extras.webBlockedDomains = blockedDomains;
    }

    const isWebTool = toolName === "WebSearch" || toolName === "WebFetch";
    const webQuery = isWebTool
        ? (toTrimmedString(payload.toolInput["query"]) || toTrimmedString(payload.toolInput["url"])).slice(0, MAX_PATH_LENGTH)
        : "";
    const entityName = filePaths[0];
    const queryOrUrl = isWebTool
        ? (toTrimmedString(payload.toolInput["query"]) || toTrimmedString(payload.toolInput["url"]))
        : undefined;
    const semantic = inferExploreSemantic(toolName, {
        ...(entityName ? {entityName} : {}),
        ...(queryOrUrl ? {queryOrUrl} : {}),
    });

    const metadata: ToolUsedMetadata = {
        ...buildSemanticMetadata(semantic),
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        toolName,
        toolInput: stringifyToolInput(payload.toolInput) as unknown as Record<string, unknown>,
        ...extras,
        ...(isWebTool && webQuery ? {webUrls: [webQuery]} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.exploration,
        title,
        body,
        filePaths: filePaths.map((fp) => fp.slice(0, MAX_PATH_LENGTH)),
        metadata,
    });
}

async function postQuestionToolEvent({payload, ids}: PostToolUseHandlerArgs): Promise<void> {
    const question = toTrimmedString(payload.toolInput["question"]);
    const options = Array.isArray(payload.toolInput["options"])
        ? payload.toolInput["options"].filter((option): option is string => typeof option === "string" && option.trim().length > 0)
        : [];
    const questionId = payload.toolUseId ? `tool-${payload.toolUseId}` : `q-${createMessageId()}`;
    const metadata = {
        ...provenEvidence("Observed directly by the AskUserQuestion PostToolUse hook."),
        questionId,
        questionPhase: "asked",
        toolName: payload.toolName,
        toolInput: stringifyToolInput(payload.toolInput),
        ...(options.length > 0 ? {options} : {}),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };

    await postTaggedEvent({
        kind: KIND.questionLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.questions,
        title: question ? `Ask: ${question.slice(0, 60)}` : "User question posed",
        ...(question ? {body: question} : {}),
        metadata,
    });
}

async function postPlanToolEvent({payload, ids}: PostToolUseHandlerArgs): Promise<void> {
    const plan = toTrimmedString(payload.toolInput["plan"]);
    const metadata = {
        ...provenEvidence("Observed directly by the ExitPlanMode PostToolUse hook."),
        toolName: payload.toolName,
        toolInput: stringifyToolInput(payload.toolInput),
        planSource: "ExitPlanMode",
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };

    await postTaggedEvent({
        kind: KIND.planLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.planning,
        title: "Exit plan mode",
        ...(plan ? {body: plan} : {}),
        metadata,
    });
}

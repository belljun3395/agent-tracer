/**
 * Shared exploration-tool PostToolUse builder used by Read, Glob, Grep,
 * WebFetch, and WebSearch. AskUserQuestion and ExitPlanMode also enter here,
 * but they are mapped to product-level question/plan events instead of generic
 * tool.used exploration cards. Each tool has
 * its own file to honour the "PascalCase = official tool" convention.
 */
import * as path from "node:path";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {createMessageId, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent} from "./_shared.js";
import type {PostToolUseHandlerArgs} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferExploreSemantic } from "~shared/semantics/inference.explore.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

const MAX_PATH_LENGTH = 300;

type ExploreTool = "Read" | "Glob" | "Grep" | "WebFetch" | "WebSearch" | "AskUserQuestion" | "ExitPlanMode";

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

    if (toolName === "Read") {
        const filePath = toTrimmedString(payload.toolInput["file_path"]);
        const relPath = relativeProjectPath(filePath);
        title = `Read: ${path.basename(relPath)}`;
        body = `Reading ${relPath}`;
        filePaths = filePath ? [filePath] : [];
    } else if (toolName === "Glob") {
        const pattern = toTrimmedString(payload.toolInput["pattern"]);
        title = `Glob: ${pattern}`;
        body = `Searching for files matching: ${pattern}`;
    } else if (toolName === "Grep") {
        const pattern = toTrimmedString(payload.toolInput["pattern"]);
        const searchPath = toTrimmedString(payload.toolInput["path"]);
        const relPath = searchPath ? relativeProjectPath(searchPath) : "";
        title = `Grep: ${pattern.slice(0, 60)}`;
        body = `Searching for '${pattern}'${relPath ? ` in ${relPath}` : ""}`;
        filePaths = searchPath ? [searchPath] : [];
    } else {
        const query = toTrimmedString(payload.toolInput["query"]) || toTrimmedString(payload.toolInput["url"]);
        title = `${toolName}: ${query.slice(0, 60)}`;
        body = `Web lookup: ${query}`;
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

    const metadata = {
        ...buildSemanticMetadata(semantic),
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        toolName,
        toolInput: stringifyToolInput(payload.toolInput),
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

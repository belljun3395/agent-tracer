/**
 * Shared exploration-tool PostToolUse builder used by Read, Glob, Grep,
 * WebFetch, WebSearch, AskUserQuestion, and ExitPlanMode. Each tool has
 * its own file to honour the "PascalCase = official tool" convention.
 */
import * as path from "node:path";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent} from "./_shared.js";
import type {PostToolUseHandlerArgs} from "./_shared.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferExploreSemantic} from "~shared/semantics/inference.js";

const MAX_PATH_LENGTH = 300;

type ExploreTool = "Read" | "Glob" | "Grep" | "WebFetch" | "WebSearch" | "AskUserQuestion" | "ExitPlanMode";

export async function postExploreToolEvent(
    {payload, ids}: PostToolUseHandlerArgs,
): Promise<void> {
    const toolName = payload.toolName as ExploreTool;
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
    } else if (toolName === "WebSearch" || toolName === "WebFetch") {
        const query = toTrimmedString(payload.toolInput["query"]) || toTrimmedString(payload.toolInput["url"]);
        title = `${toolName}: ${query.slice(0, 60)}`;
        body = `Web lookup: ${query}`;
    } else if (toolName === "AskUserQuestion") {
        const question = toTrimmedString(payload.toolInput["question"]);
        title = `Ask: ${question.slice(0, 60)}`;
        body = question ? `Asked user: ${question}` : "User question posed";
    } else {
        // ExitPlanMode — exhaustive case
        const plan = toTrimmedString(payload.toolInput["plan"]);
        title = "Exit plan mode";
        body = plan ? `Plan summary: ${plan.slice(0, 200)}` : "Plan finalized";
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

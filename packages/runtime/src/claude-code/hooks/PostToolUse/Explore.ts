/**
 * Claude Code Hook: PostToolUse — matcher: "Read|Glob|Grep|WebSearch|WebFetch"
 *
 * Fires after any exploration tool succeeds. Does not fire on failures.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#posttooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PostToolUse"
 *   tool_name        string  — "Read" | "Glob" | "Grep" | "WebSearch" | "WebFetch"
 *   tool_input       object  — tool-specific input (see below)
 *   tool_response    any     — tool output (potentially large; not used here)
 *   tool_use_id      string  — unique ID for this tool invocation
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * Tool-specific tool_input fields:
 *   Read:      { file_path: string }
 *   Glob:      { pattern: string, path?: string }
 *   Grep:      { pattern: string, path?: string, glob?: string }
 *   WebSearch: { query: string }
 *   WebFetch:  { url: string, prompt?: string }
 *
 * Blocking: PostToolUse cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler posts a /ingest/v1/events event with kind "tool.used" and
 * attaches exploration-lane semantic metadata from the runtime.
 */
import * as path from "node:path";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferExploreSemantic} from "~shared/semantics/inference.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";

const MAX_PATH_LENGTH = 300;

async function main(): Promise<void> {
    const {
        sessionId,
        agentId,
        agentType,
        toolName,
        toolInput,
        toolUseId
    } = await readToolHookContext("PostToolUse/Explore");
    hookLog("PostToolUse/Explore", "fired", {toolName, sessionId: sessionId || "(none)"});

    if (!sessionId) {
        hookLog("PostToolUse/Explore", "skipped — no sessionId");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    let title = `Explore: ${toolName}`;
    let body = `Used ${toolName} to explore`;
    let filePaths: string[] = [];

    if (toolName === "Read") {
        const filePath = toTrimmedString(toolInput.file_path);
        const relPath = relativeProjectPath(filePath);
        title = `Read: ${path.basename(relPath)}`;
        body = `Reading ${relPath}`;
        filePaths = filePath ? [filePath] : [];
    } else if (toolName === "Glob") {
        const pattern = toTrimmedString(toolInput.pattern);
        title = `Glob: ${pattern}`;
        body = `Searching for files matching: ${pattern}`;
    } else if (toolName === "Grep") {
        const pattern = toTrimmedString(toolInput.pattern);
        const searchPath = toTrimmedString(toolInput.path);
        const relPath = searchPath ? relativeProjectPath(searchPath) : "";
        title = `Grep: ${pattern.slice(0, 60)}`;
        body = `Searching for '${pattern}'${relPath ? ` in ${relPath}` : ""}`;
        filePaths = searchPath ? [searchPath] : [];
    } else if (toolName === "WebSearch" || toolName === "WebFetch") {
        const query = toTrimmedString(toolInput.query) || toTrimmedString(toolInput.url);
        title = `${toolName}: ${query.slice(0, 60)}`;
        body = `Web lookup: ${query}`;
    }

    const isWebTool = toolName === "WebSearch" || toolName === "WebFetch";
    const webQuery = isWebTool
        ? (toTrimmedString(toolInput.query) || toTrimmedString(toolInput.url)).slice(0, MAX_PATH_LENGTH)
        : "";
    const entityName = filePaths[0] ?? undefined
    const queryOrUrl = isWebTool
        ? (toTrimmedString(toolInput.query) || toTrimmedString(toolInput.url))
        : undefined
    const semantic = inferExploreSemantic(toolName, {
        ...(entityName ? {entityName} : {}),
        ...(queryOrUrl ? {queryOrUrl} : {}),
    })

    const exploreMeta = {
        ...buildSemanticMetadata(semantic),
        ...provenEvidence("Observed directly by the Explore PostToolUse hook."),
        toolName,
        toolInput: stringifyToolInput(toolInput),
        ...(isWebTool && webQuery ? {webUrls: [webQuery]} : {}),
        ...(toolUseId ? {toolUseId} : {})
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.exploration,
        title,
        body,
        filePaths: filePaths.map((fp) => fp.slice(0, MAX_PATH_LENGTH)),
        metadata: exploreMeta
    });
    hookLog("PostToolUse/Explore", "explore posted", {toolName, title});
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Explore", "ERROR", {error: String(err)});
});

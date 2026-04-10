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
 * This handler classifies the explore operation semantically and posts
 * an /api/explore event to the Agent Tracer monitor.
 */
import * as path from "node:path";
import { buildSemanticMetadata, getSessionId, getToolInput, hookLog, hookLogPayload, inferExploreSemantic, postJson, readStdinJson, relativeProjectPath, resolveSessionIds, stringifyToolInput, toTrimmedString } from "../common.js";

const MAX_PATH_LENGTH = 300;

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PostToolUse/Explore", payload);
    const sessionId = getSessionId(payload);
    const toolName = toTrimmedString(payload.tool_name);
    const toolInput = getToolInput(payload);
    hookLog("PostToolUse/Explore", "fired", { toolName, sessionId: sessionId || "(none)" });

    if (!sessionId) {
        hookLog("PostToolUse/Explore", "skipped — no sessionId");
        return;
    }

    const ids = await resolveSessionIds(sessionId);
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

    const semantic = inferExploreSemantic(toolName, toolInput);
    const isWebTool = toolName === "WebSearch" || toolName === "WebFetch";
    const webQuery = isWebTool
        ? (toTrimmedString(toolInput.query) || toTrimmedString(toolInput.url)).slice(0, MAX_PATH_LENGTH)
        : "";

    await postJson("/api/explore", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        toolName,
        title,
        body,
        filePaths: filePaths.map((fp) => fp.slice(0, MAX_PATH_LENGTH)),
        metadata: {
            ...buildSemanticMetadata(semantic),
            toolInput: stringifyToolInput(toolInput),
            ...(isWebTool && webQuery ? { webUrls: [webQuery] } : {})
        }
    });
    hookLog("PostToolUse/Explore", "explore posted", { toolName, title });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Explore", "ERROR", { error: String(err) });
});

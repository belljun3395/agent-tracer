import * as path from "node:path";
import { buildSemanticMetadata, cacheSessionResult, ensureRuntimeSession, getCachedSessionResult, getSessionId, getToolInput, hookLog, hookLogPayload, inferExploreSemantic, postJson, readStdinJson, relativeProjectPath, stringifyToolInput, toTrimmedString } from "./common.js";
const MAX_PATH_LENGTH = 300;
async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("explore", payload);
    const sessionId = getSessionId(payload);
    const toolName = toTrimmedString(payload.tool_name);
    const toolInput = getToolInput(payload);
    hookLog("explore", "fired", { toolName, sessionId: sessionId || "(none)" });
    if (!sessionId) {
        hookLog("explore", "skipped — no sessionId");
        return;
    }
    const ids = getCachedSessionResult(sessionId) ?? await (async () => {
        const fresh = await ensureRuntimeSession(sessionId);
        cacheSessionResult(sessionId, fresh);
        return fresh;
    })();
    let title = `Explore: ${toolName}`;
    let body = `Used ${toolName} to explore`;
    let filePaths: string[] = [];
    if (toolName === "Read") {
        const filePath = toTrimmedString(toolInput.file_path);
        const relPath = relativeProjectPath(filePath);
        title = `Read: ${path.basename(relPath)}`;
        body = `Reading ${relPath}`;
        filePaths = filePath ? [filePath] : [];
    }
    else if (toolName === "Glob") {
        const pattern = toTrimmedString(toolInput.pattern);
        title = `Glob: ${pattern}`;
        body = `Searching for files matching: ${pattern}`;
    }
    else if (toolName === "Grep") {
        const pattern = toTrimmedString(toolInput.pattern);
        const searchPath = toTrimmedString(toolInput.path);
        const relPath = searchPath ? relativeProjectPath(searchPath) : "";
        title = `Grep: ${pattern.slice(0, 60)}`;
        body = `Searching for '${pattern}'${relPath ? ` in ${relPath}` : ""}`;
        filePaths = searchPath ? [searchPath] : [];
    }
    else if (toolName === "WebSearch" || toolName === "WebFetch") {
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
        filePaths: filePaths.map((filePath) => filePath.slice(0, MAX_PATH_LENGTH)),
        metadata: {
            ...buildSemanticMetadata(semantic),
            toolInput: stringifyToolInput(toolInput),
            ...(isWebTool && webQuery ? { webUrls: [webQuery] } : {})
        }
    });
    hookLog("explore", "explore posted", { toolName, title });
}
void main().catch((err: unknown) => {
    hookLog("explore", "ERROR", { error: String(err) });
});

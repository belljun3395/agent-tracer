import * as path from "node:path";
import { buildSemanticMetadata, cacheSessionResult, ensureRuntimeSession, getCachedSessionResult, getHookEventName, getSessionId, getToolInput, hookLog, hookLogPayload, inferCommandSemantic, inferFileToolSemantic, parseMcpToolName, postJson, readStdinJson, relativeProjectPath, toBoolean, toTrimmedString } from "./common.js";
function filePathFromToolInput(toolInput: Record<string, unknown>): string {
    return toTrimmedString(toolInput.file_path)
        || toTrimmedString(toolInput.path)
        || toTrimmedString(toolInput.pattern);
}
async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("tool_used", payload);
    const hookEventName = getHookEventName(payload) || "PostToolUse";
    const toolName = toTrimmedString(payload.tool_name);
    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    hookLog("tool_used", "fired", { hookEventName, toolName, sessionId: sessionId || "(none)" });
    if (!sessionId || !toolName) {
        hookLog("tool_used", "skipped — missing sessionId or toolName");
        return;
    }
    const mcpToolEarly = parseMcpToolName(toolName);
    if (mcpToolEarly?.server === "agent-tracer") {
        hookLog("tool_used", "skipped — agent-tracer MCP self-reference", { toolName });
        return;
    }
    const ids = getCachedSessionResult(sessionId) ?? await (async () => {
        const fresh = await ensureRuntimeSession(sessionId);
        cacheSessionResult(sessionId, fresh);
        return fresh;
    })();
    const filePath = filePathFromToolInput(toolInput);
    const relPath = filePath ? relativeProjectPath(filePath) : "";
    const mcpTool = parseMcpToolName(toolName);
    let title = relPath ? `${toolName}: ${path.basename(relPath)}` : toolName;
    let body = relPath ? `Modified ${relPath}` : `Used ${toolName}`;
    let endpoint: "/api/tool-used" | "/api/agent-activity" = "/api/tool-used";
    let lane: "exploration" | "implementation" | "coordination" | undefined = "implementation";
    let activityType: "mcp_call" | undefined;
    let semanticMetadata = buildSemanticMetadata(inferFileToolSemantic(toolName, toolInput));
    const metadata: Record<string, unknown> = {};
    if (toolName === "Bash") {
        const description = toTrimmedString(toolInput.description);
        metadata.description = description;
        semanticMetadata = buildSemanticMetadata(inferCommandSemantic(toTrimmedString(toolInput.command)).metadata);
    }
    else if (mcpTool) {
        title = `MCP: ${mcpTool.server}/${mcpTool.tool}`;
        body = `Used MCP tool ${mcpTool.server}/${mcpTool.tool}`;
        endpoint = "/api/agent-activity";
        lane = "coordination";
        activityType = "mcp_call";
        semanticMetadata = buildSemanticMetadata({
            subtypeKey: "mcp_call",
            subtypeLabel: "MCP call",
            subtypeGroup: "coordination",
            toolFamily: "coordination",
            operation: "invoke",
            entityType: "mcp",
            entityName: `${mcpTool.server}/${mcpTool.tool}`,
            sourceTool: toolName
        });
        metadata.mcpServer = mcpTool.server;
        metadata.mcpTool = mcpTool.tool;
    }
    if (hookEventName === "PostToolUseFailure") {
        title = `Failed ${toolName}`;
        body = toTrimmedString(payload.error) || `Tool failed: ${toolName}`;
        metadata.failed = true;
        metadata.error = toTrimmedString(payload.error);
        metadata.isInterrupt = toBoolean(payload.is_interrupt);
    }
    else if (filePath) {
        metadata.filePath = filePath;
        metadata.relPath = relPath;
    }
    const requestBody = {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        ...(endpoint === "/api/tool-used" ? { toolName } : {}),
        title,
        body,
        lane,
        ...(filePath && hookEventName !== "PostToolUseFailure" ? { filePaths: [filePath] } : {}),
        metadata: {
            ...semanticMetadata,
            ...metadata
        }
    };
    if (endpoint === "/api/agent-activity") {
        await postJson(endpoint, {
            ...requestBody,
            activityType: activityType ?? "mcp_call",
            ...(mcpTool ? { mcpServer: mcpTool.server, mcpTool: mcpTool.tool } : {})
        });
    }
    else {
        await postJson(endpoint, requestBody);
    }
    hookLog("tool_used", "tool-used posted", { toolName, title });
}
void main().catch((err: unknown) => {
    hookLog("tool_used", "ERROR", { error: String(err) });
});

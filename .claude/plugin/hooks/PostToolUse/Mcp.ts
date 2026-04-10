/**
 * Claude Code Hook: PostToolUse — matcher: "mcp__.*"
 *
 * Fires after any MCP (Model Context Protocol) tool call succeeds.
 * The matcher is treated as a JavaScript regex by Claude Code.
 * Does not fire on failures — PostToolUseFailure.ts handles that.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#posttooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PostToolUse"
 *   tool_name        string  — MCP tool in format "mcp__{server}__{tool}"
 *   tool_input       object  — MCP tool input parameters
 *   tool_response    any     — MCP tool result (not used here)
 *   tool_use_id      string  — unique ID for this tool invocation
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * Blocking: PostToolUse cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler posts a /api/agent-activity event with activityType "mcp_call"
 * to the Agent Tracer monitor. Self-referential calls to the "agent-tracer" MCP
 * server are skipped to avoid infinite loops.
 */
import { buildSemanticMetadata, getSessionId, hookLog, hookLogPayload, LANE, parseMcpToolName, postJson, readStdinJson, resolveSessionIds, toTrimmedString } from "../common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PostToolUse/Mcp", payload);
    const toolName = toTrimmedString(payload.tool_name);
    const sessionId = getSessionId(payload);
    hookLog("PostToolUse/Mcp", "fired", { toolName, sessionId: sessionId || "(none)" });

    if (!sessionId || !toolName) {
        hookLog("PostToolUse/Mcp", "skipped — missing sessionId or toolName");
        return;
    }

    const mcpTool = parseMcpToolName(toolName);
    if (!mcpTool) {
        hookLog("PostToolUse/Mcp", "skipped — not an MCP tool", { toolName });
        return;
    }
    if (mcpTool.server === "agent-tracer") {
        hookLog("PostToolUse/Mcp", "skipped — agent-tracer MCP self-reference");
        return;
    }

    const ids = await resolveSessionIds(sessionId);
    const title = `MCP: ${mcpTool.server}/${mcpTool.tool}`;
    const body = `Used MCP tool ${mcpTool.server}/${mcpTool.tool}`;

    await postJson("/api/agent-activity", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        activityType: "mcp_call",
        title,
        body,
        lane: LANE.coordination,
        mcpServer: mcpTool.server,
        mcpTool: mcpTool.tool,
        metadata: {
            ...buildSemanticMetadata({
                subtypeKey: "mcp_call",
                subtypeLabel: "MCP call",
                subtypeGroup: "coordination",
                toolFamily: "coordination",
                operation: "invoke",
                entityType: "mcp",
                entityName: `${mcpTool.server}/${mcpTool.tool}`,
                sourceTool: toolName
            }),
            mcpServer: mcpTool.server,
            mcpTool: mcpTool.tool
        }
    });
    hookLog("PostToolUse/Mcp", "agent-activity posted", { title });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Mcp", "ERROR", { error: String(err) });
});

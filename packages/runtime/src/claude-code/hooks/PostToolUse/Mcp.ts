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
import {parseMcpToolName} from "~claude-code/hooks/util/payload.js";
import {readToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {KIND} from "~shared/events/kinds.js";
import {type AgentActivityMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferMcpSemantic} from "~shared/semantics/inference.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";

async function main(): Promise<void> {
    const {sessionId, agentId, agentType, toolName, toolUseId} = await readToolHookContext("PostToolUse/Mcp");
    hookLog("PostToolUse/Mcp", "fired", {toolName, sessionId: sessionId || "(none)"});

    if (!sessionId || !toolName) {
        hookLog("PostToolUse/Mcp", "skipped — missing sessionId or toolName");
        return;
    }

    const mcpTool = parseMcpToolName(toolName);
    if (!mcpTool) {
        hookLog("PostToolUse/Mcp", "skipped — not an MCP tool", {toolName});
        return;
    }
    if (mcpTool.server === "agent-tracer") {
        hookLog("PostToolUse/Mcp", "skipped — agent-tracer MCP self-reference");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const semantic = inferMcpSemantic(mcpTool.server, mcpTool.tool, toolName)
    const title = `MCP: ${mcpTool.server}/${mcpTool.tool}`;
    const body = `Used MCP tool ${mcpTool.server}/${mcpTool.tool}`;

    const baseMeta: AgentActivityMetadata = {
        ...provenEvidence("Observed directly by the Mcp PostToolUse hook."),
        ...buildSemanticMetadata(semantic),
        activityType: "mcp_call",
        mcpServer: mcpTool.server,
        mcpTool: mcpTool.tool,
        ...(toolUseId ? {toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.agentActivityLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.coordination,
        title,
        body,
        metadata: baseMeta,
    });
    hookLog("PostToolUse/Mcp", "agent-activity posted", {title});
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Mcp", "ERROR", {error: String(err)});
});

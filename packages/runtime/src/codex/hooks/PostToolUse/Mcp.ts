/**
 * Codex Hook: PostToolUse — matcher: "mcp__.*"
 *
 * Captures Codex MCP tool calls. Naming mirrors Claude's mcp__server__tool
 * convention; Codex emits the same `tool_name` shape via app-server.
 *
 * Self-referential calls to the "agent-tracer" MCP server are skipped to
 * avoid recursive monitoring.
 *
 * Marked `crossCheck.source = "hook"`; rollout observer parallel events
 * use `source = "rollout"`. Server dedupes on (kind, sessionId, dedupeKey).
 */
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {readCodexPostToolUse} from "~shared/hooks/codex/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { AgentActivityMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferMcpSemantic } from "~shared/semantics/inference.coordination.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

function parseMcpToolName(toolName: string): { server: string; tool: string } | null {
    if (!toolName.startsWith("mcp__")) return null;
    const parts = toolName.split("__");
    if (parts.length < 3) return null;
    const server = parts[1]?.trim();
    const tool = parts.slice(2).join("__").trim();
    if (!server || !tool) return null;
    return {server, tool};
}

await runHook("PostToolUse/Mcp", {
    logger: codexHookRuntime.logger,
    parse: readCodexPostToolUse,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const mcpTool = parseMcpToolName(payload.toolName);
        if (!mcpTool) return;
        if (mcpTool.server === "agent-tracer") return;

        const ids = await ensureRuntimeSession(payload.sessionId);
        const semantic = inferMcpSemantic(mcpTool.server, mcpTool.tool, payload.toolName);
        const dedupeKey = payload.toolUseId
            || `${payload.toolName}:${payload.turnId ?? ""}`;

        const metadata: AgentActivityMetadata = {
            ...provenEvidence("Observed directly by the Codex PostToolUse/Mcp hook."),
            ...buildSemanticMetadata(semantic),
            activityType: "mcp_call",
            mcpServer: mcpTool.server,
            mcpTool: mcpTool.tool,
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
            crossCheck: {source: "hook", dedupeKey},
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.agentActivityLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.coordination,
            title: `MCP: ${mcpTool.server}/${mcpTool.tool}`,
            body: `Used MCP tool ${mcpTool.server}/${mcpTool.tool}`,
            metadata,
        });
    },
});

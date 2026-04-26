/**
 * Claude Code Hook: PostToolUse — matcher regex: "mcp__.*"
 *
 * File name is `Mcp.ts` because "mcp__*" is a wildcard match across all
 * MCP tools rather than a single official tool identifier. The matcher in
 * hooks.json remains the documented `mcp__.*` regex.
 *
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse
 *
 * MCP tool_name format: "mcp__{server}__{tool}"
 *
 * Self-referential calls to the "agent-tracer" MCP server are skipped to
 * avoid infinite loops.
 */
import {parseMcpToolName} from "~claude-code/hooks/util/payload.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { AgentActivityMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferMcpSemantic } from "~shared/semantics/inference.coordination.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("Mcp", async ({payload, ids}) => {
    const mcpTool = parseMcpToolName(payload.toolName);
    if (!mcpTool) return;
    if (mcpTool.server === "agent-tracer") return;

    const semantic = inferMcpSemantic(mcpTool.server, mcpTool.tool, payload.toolName);
    const title = `MCP: ${mcpTool.server}/${mcpTool.tool}`;
    const body = `Used MCP tool ${mcpTool.server}/${mcpTool.tool}`;

    const metadata: AgentActivityMetadata = {
        ...provenEvidence("Observed directly by the Mcp PostToolUse hook."),
        ...buildSemanticMetadata(semantic),
        activityType: "mcp_call",
        mcpServer: mcpTool.server,
        mcpTool: mcpTool.tool,
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.agentActivityLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.coordination,
        title,
        body,
        metadata,
    });
});

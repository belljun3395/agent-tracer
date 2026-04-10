/**
 * Claude Code Hook: PostToolUseFailure
 *
 * Fires after a tool call fails (non-zero exit, exception, or timeout).
 *
 * Configured matcher: "Bash|Edit|Write|Agent|Skill|TaskCreate|TaskUpdate|TodoWrite|mcp__.*"
 * (treated as a JavaScript regex by Claude Code because it contains regex meta-characters)
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#posttooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PostToolUseFailure"
 *   tool_name        string  — tool that failed
 *   tool_input       object  — the tool's input parameters
 *   tool_use_id      string  — unique ID for this tool invocation
 *   error            string  — error message from the failed tool
 *   is_interrupt     boolean — whether the failure was due to user interrupt
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * Blocking: PostToolUseFailure cannot block (exit 2 shows stderr but execution continues).
 *           Ref: https://code.claude.com/docs/en/hooks#exit-code-2-behavior-matrix
 *
 * This handler records the failure in the Agent Tracer monitor. MCP tool failures
 * are posted to /api/agent-activity; all other tool failures go to /api/tool-used.
 */
import { buildSemanticMetadata, getSessionId, getToolInput, hookLog, hookLogPayload, inferCommandSemantic, LANE, parseMcpToolName, postJson, readStdinJson, resolveSessionIds, toBoolean, toTrimmedString } from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PostToolUseFailure", payload);
    const toolName = toTrimmedString(payload.tool_name);
    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    hookLog("PostToolUseFailure", "fired", { toolName, sessionId: sessionId || "(none)" });

    if (!sessionId || !toolName) {
        hookLog("PostToolUseFailure", "skipped — missing sessionId or toolName");
        return;
    }

    const mcpTool = parseMcpToolName(toolName);
    if (mcpTool?.server === "agent-tracer") {
        hookLog("PostToolUseFailure", "skipped — agent-tracer MCP self-reference");
        return;
    }

    const ids = await resolveSessionIds(sessionId);
    const title = `Failed ${toolName}`;
    const body = toTrimmedString(payload.error) || `Tool failed: ${toolName}`;
    const failureMetadata = {
        failed: true,
        error: toTrimmedString(payload.error),
        isInterrupt: toBoolean(payload.is_interrupt)
    };

    if (mcpTool) {
        await postJson("/ingest/v1/events", {
            events: [{
                kind: "agent.activity.logged",
                taskId: ids.taskId,
                sessionId: ids.sessionId,
                activityType: "mcp_call",
                title,
                body,
                lane: LANE.coordination,
                mcpServer: mcpTool.server,
                mcpTool: mcpTool.tool,
                metadata: { ...failureMetadata, mcpServer: mcpTool.server, mcpTool: mcpTool.tool }
            }]
        });
    } else {
        // Include semantic metadata for Bash failures so downstream consumers can
        // classify what kind of command failed (test run, build, lint, etc.).
        const semanticMetadata = toolName === "Bash"
            ? buildSemanticMetadata(inferCommandSemantic(toTrimmedString(toolInput.command)).metadata)
            : {};
        const description = toolName === "Bash" ? toTrimmedString(toolInput.description) : undefined;

        await postJson("/ingest/v1/events", {
            events: [{
                kind: "tool.used",
                taskId: ids.taskId,
                sessionId: ids.sessionId,
                toolName,
                title,
                body,
                lane: LANE.implementation,
                metadata: {
                    ...(description ? { description } : {}),
                    ...semanticMetadata,
                    ...failureMetadata
                }
            }]
        });
    }
    hookLog("PostToolUseFailure", "failure posted", { toolName, title });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUseFailure", "ERROR", { error: String(err) });
});

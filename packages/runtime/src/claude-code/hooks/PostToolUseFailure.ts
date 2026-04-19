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
 * are posted to /api/agent-activity; all other tool failures go to /api/tool-used,
 * with runtime-derived lane and semantic metadata when the tool type is known.
 */
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {parseMcpToolName} from "~claude-code/hooks/util/payload.js";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {toBoolean, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {
    buildSemanticMetadata,
    inferAgentSemantic,
    inferCommandSemantic,
    inferFileToolSemantic,
    inferMcpSemantic,
    inferSkillSemantic
} from "~shared/semantics/inference.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";

async function main(): Promise<void> {
    const {
        payload,
        sessionId,
        agentId,
        agentType,
        toolName,
        toolInput,
        toolUseId
    } = await readToolHookContext("PostToolUseFailure");
    hookLog("PostToolUseFailure", "fired", {toolName, sessionId: sessionId || "(none)"});

    if (!sessionId || !toolName) {
        hookLog("PostToolUseFailure", "skipped — missing sessionId or toolName");
        return;
    }

    const mcpTool = parseMcpToolName(toolName);
    if (mcpTool?.server === "agent-tracer") {
        hookLog("PostToolUseFailure", "skipped — agent-tracer MCP self-reference");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const title = `Failed ${toolName}`;
    const body = toTrimmedString(payload.error) || `Tool failed: ${toolName}`;
    const failureMetadata = {
        ...provenEvidence("Observed directly by the PostToolUseFailure hook."),
        failed: true,
        error: toTrimmedString(payload.error),
        isInterrupt: toBoolean(payload.is_interrupt),
        ...(toolUseId ? {toolUseId} : {})
    };

    if (mcpTool) {
        const semantic = inferMcpSemantic(mcpTool.server, mcpTool.tool, toolName)
        const mcpFailureMeta = {
            ...buildSemanticMetadata(semantic),
            ...failureMetadata,
            mcpServer: mcpTool.server,
            mcpTool: mcpTool.tool
        };
        await postTaggedEvent({
            kind: KIND.agentActivityLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: "coordination",
            activityType: "mcp_call",
            title,
            body,
            mcpServer: mcpTool.server,
            mcpTool: mcpTool.tool,
            metadata: mcpFailureMeta
        });
    } else {
        const description = toolName === "Bash" ? toTrimmedString(toolInput.description) : undefined;
        const command = toolName === "Bash" ? toTrimmedString(toolInput.command) : undefined;
        const filePath = toolName === "Edit" || toolName === "Write"
            ? (toTrimmedString(toolInput.file_path) || toTrimmedString(toolInput.path) || "")
            : ""
        const relPath = filePath ? relativeProjectPath(filePath) : ""

        const failureClassification = (() => {
            if (toolName === "Bash" && command) {
                const {lane, metadata} = inferCommandSemantic(command)
                return {lane, metadata}
            }
            if (toolName === "Edit" || toolName === "Write") {
                return {
                    lane: "implementation" as const,
                    metadata: inferFileToolSemantic(toolName, relPath || undefined)
                }
            }
            if (toolName === "Skill") {
                return {
                    lane: "coordination" as const,
                    metadata: inferSkillSemantic(toTrimmedString(toolInput.skill) || undefined, "Skill")
                }
            }
            if (toolName === "Agent") {
                return {
                    lane: "coordination" as const,
                    metadata: inferAgentSemantic(toTrimmedString(toolInput.subagent_type) || undefined, "Agent")
                }
            }
            return null
        })()

        const toolFailureMeta = {
            ...(failureClassification ? buildSemanticMetadata(failureClassification.metadata) : {}),
            ...(description ? {description} : {}),
            ...failureMetadata
        };
        await postTaggedEvent({
            kind: KIND.toolUsed,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: failureClassification?.lane ?? LANE.implementation,
            toolName,
            title,
            body,
            ...(command ? {command} : {}),
            metadata: toolFailureMeta
        });
    }
    hookLog("PostToolUseFailure", "failure posted", {toolName, title});
}

void main().catch((err: unknown) => {
    hookLog("PostToolUseFailure", "ERROR", {error: String(err)});
});

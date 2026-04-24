/**
 * Claude Code Hook: PostToolUseFailure
 *
 * Ref: https://code.claude.com/docs/en/hooks#posttooluse (failure variant)
 *
 * Configured matcher: "Bash|Edit|Write|Read|Glob|Grep|WebFetch|WebSearch|
 *                     Agent|Skill|TaskCreate|TaskUpdate|TodoWrite|
 *                     AskUserQuestion|ExitPlanMode|mcp__.*"
 * (JS regex in hooks.json)
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "PostToolUseFailure"
 *   tool_name        string
 *   tool_input       object
 *   tool_use_id      string
 *   error            string
 *   is_interrupt     boolean
 *   agent_id         string?
 *
 * Blocking: No.
 */
import {parseMcpToolName} from "~claude-code/hooks/util/payload.js";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readPostToolUseFailure} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {
    buildSemanticMetadata,
    inferAgentSemantic,
    inferCommandSemantic,
    inferFileToolSemantic,
    inferMcpSemantic,
    inferSkillSemantic,
} from "~shared/semantics/inference.js";

await runHook("PostToolUseFailure", {
    logger: claudeHookRuntime.logger,
    parse: readPostToolUseFailure,
    handler: async (payload) => {
        if (!payload.sessionId || !payload.toolName) return;
        const mcpTool = parseMcpToolName(payload.toolName);
        if (mcpTool?.server === "agent-tracer") return;

        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const title = `Failed ${payload.toolName}`;
        const body = payload.error || `Tool failed: ${payload.toolName}`;
        const failureMetadata = {
            ...provenEvidence("Observed directly by the PostToolUseFailure hook."),
            failed: true,
            error: payload.error,
            isInterrupt: payload.isInterrupt,
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
        };

        if (mcpTool) {
            const semantic = inferMcpSemantic(mcpTool.server, mcpTool.tool, payload.toolName);
            await claudeHookRuntime.transport.postTaggedEvent({
                kind: KIND.agentActivityLogged,
                taskId: ids.taskId,
                sessionId: ids.sessionId,
                lane: "coordination",
                activityType: "mcp_call",
                title,
                body,
                mcpServer: mcpTool.server,
                mcpTool: mcpTool.tool,
                metadata: {
                    ...buildSemanticMetadata(semantic),
                    ...failureMetadata,
                    mcpServer: mcpTool.server,
                    mcpTool: mcpTool.tool,
                },
            });
            return;
        }

        const description = payload.toolName === "Bash" ? toTrimmedString(payload.toolInput["description"]) : undefined;
        const command = payload.toolName === "Bash" ? toTrimmedString(payload.toolInput["command"]) : undefined;
        const filePath = payload.toolName === "Edit" || payload.toolName === "Write"
            ? (toTrimmedString(payload.toolInput["file_path"]) || toTrimmedString(payload.toolInput["path"]) || "")
            : "";
        const relPath = filePath ? relativeProjectPath(filePath) : "";

        const classification = (() => {
            if (payload.toolName === "Bash" && command) {
                const {lane, metadata} = inferCommandSemantic(command);
                return {lane, metadata};
            }
            if (payload.toolName === "Edit" || payload.toolName === "Write") {
                return {
                    lane: "implementation" as const,
                    metadata: inferFileToolSemantic(payload.toolName, relPath || undefined),
                };
            }
            if (payload.toolName === "Skill") {
                return {
                    lane: "coordination" as const,
                    metadata: inferSkillSemantic(toTrimmedString(payload.toolInput["skill"]) || undefined, "Skill"),
                };
            }
            if (payload.toolName === "Agent") {
                return {
                    lane: "coordination" as const,
                    metadata: inferAgentSemantic(toTrimmedString(payload.toolInput["subagent_type"]) || undefined, "Agent"),
                };
            }
            return null;
        })();

        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.toolUsed,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: classification?.lane ?? LANE.implementation,
            toolName: payload.toolName,
            title,
            body,
            ...(command ? {command} : {}),
            metadata: {
                ...(classification ? buildSemanticMetadata(classification.metadata) : {}),
                ...(description ? {description} : {}),
                ...failureMetadata,
            },
        });
    },
});

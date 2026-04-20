/**
 * Claude Code Hook: SubagentStop
 *
 * Fires when a subagent finishes. No matcher is supported — fires for every
 * subagent regardless of type.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#subagentstartstop):
 *   session_id              string  — parent session identifier
 *   hook_event_name         string  — "SubagentStop"
 *   agent_id                string  — unique ID of the finished agent
 *   agent_type              string  — agent type name
 *   stop_hook_active        boolean — whether the Stop hook is running for the subagent
 *   last_assistant_message  string? — last message from the subagent
 *   cwd                     string  — current working directory
 *
 * Blocking: SubagentStop CAN block (exit 2 prevents the subagent from completing).
 *           Ref: https://code.claude.com/docs/en/hooks#exit-code-2-behavior-matrix
 *
 * This handler:
 *   1. Posts an async-task "completed" event to the parent task.
 *   2. Ends the virtual monitor session for the subagent (sub--{agentId}) so the
 *      server can auto-complete the background child task.
 *   3. Cleans up the todo state for the virtual session.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {CLAUDE_RUNTIME_SOURCE} from "~claude-code/hooks/util/paths.const.js";
import {readHookSessionContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {
    ensureRuntimeSession,
    postJson,
    postTaggedEvent
} from "~claude-code/hooks/lib/transport/transport.js";
import {KIND} from "~shared/events/kinds.js";
import {type ActionLoggedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {deleteTodoState} from "~claude-code/hooks/PostToolUse/Todo/todo.state.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";

async function main(): Promise<void> {
    const {payload, sessionId, agentId, agentType} = await readHookSessionContext("SubagentStop");
    const normalizedAgentId = agentId ?? "";
    const normalizedAgentType = agentType ?? "";
    hookLog("SubagentStop", "fired", {
        agentId: normalizedAgentId || "(none)",
        agentType: normalizedAgentType,
        sessionId: sessionId || "(none)"
    });

    if (!sessionId || !normalizedAgentId) {
        hookLog("SubagentStop", "skipped — missing sessionId or agentId");
        return;
    }

    const ids = await ensureRuntimeSession(sessionId);
    const virtualId = `sub--${normalizedAgentId}`;

    const baseMeta: ActionLoggedMetadata = {
        ...provenEvidence("Emitted by the SubagentStop hook."),
        asyncTaskId: normalizedAgentId,
        asyncStatus: "completed",
        agentId: normalizedAgentId,
        agentType: normalizedAgentType,
        parentTaskId: ids.taskId,
        parentSessionId: sessionId,
    };
    await postTaggedEvent({
        kind: KIND.actionLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.background,
        title: `Subagent finished: ${normalizedAgentType}`,
        ...(toTrimmedString(payload.last_assistant_message)
            ? {body: toTrimmedString(payload.last_assistant_message, 400)}
            : {}),
        metadata: baseMeta,
    });
    hookLog("SubagentStop", "async-task posted", {agentType: normalizedAgentType, agentId: normalizedAgentId});

    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: virtualId,
        summary: `Subagent finished: ${normalizedAgentType}`,
        completeTask: false,
        completionReason: "assistant_turn_complete"
    });
    hookLog("SubagentStop", "virtual session ended", {virtualId});

    deleteTodoState(virtualId);
}

void main().catch((err: unknown) => {
    hookLog("SubagentStop", "ERROR", {error: String(err)});
});

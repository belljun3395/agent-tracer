/**
 * Claude Code Hook: SubagentStop
 *
 * Ref: https://code.claude.com/docs/en/hooks#subagentstop
 *
 * Fires when a subagent finishes.
 *
 * Stdin payload fields:
 *   session_id              string — parent session
 *   hook_event_name         string — "SubagentStop"
 *   subagent_type           string
 *   stop_reason             string?
 *   last_assistant_message  string?
 *
 * Blocking: Yes (decision: "block"). This handler never blocks.
 *
 * Posts an async-task "completed" event, ends the virtual monitor session
 * for the subagent, and cleans up the virtual-session todo state.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {CLAUDE_RUNTIME_SOURCE} from "~claude-code/hooks/util/paths.const.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {ensureRuntimeSession, postJson} from "~claude-code/hooks/lib/transport/transport.js";
import {readSubagentStop} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ActionLoggedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {deleteTodoState} from "~claude-code/hooks/PostToolUse/Todo/todo.state.js";

await runHook("SubagentStop", {
    logger: claudeHookRuntime.logger,
    parse: readSubagentStop,
    handler: async (payload) => {
        if (!payload.sessionId || !payload.agentId) return;
        const agentId = payload.agentId;

        const ids = await ensureRuntimeSession(payload.sessionId);
        const virtualId = `sub--${agentId}`;

        const metadata: ActionLoggedMetadata = {
            ...provenEvidence("Emitted by the SubagentStop hook."),
            asyncTaskId: agentId,
            asyncStatus: "completed",
            agentId,
            agentType: payload.subagentType,
            parentTaskId: ids.taskId,
            parentSessionId: payload.sessionId,
        };
        const lastMessage = toTrimmedString(payload.payload["last_assistant_message"], 400);
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.actionLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.background,
            title: `Subagent finished: ${payload.subagentType}`,
            ...(lastMessage ? {body: lastMessage} : {}),
            metadata,
        });

        await postJson("/api/runtime-session-end", {
            runtimeSource: CLAUDE_RUNTIME_SOURCE,
            runtimeSessionId: virtualId,
            summary: `Subagent finished: ${payload.subagentType}`,
            completeTask: false,
            completionReason: "assistant_turn_complete",
        });

        deleteTodoState(virtualId);
    },
});

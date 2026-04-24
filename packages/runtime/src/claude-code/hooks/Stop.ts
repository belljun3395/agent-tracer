/**
 * Claude Code Hook: Stop
 *
 * Ref: https://code.claude.com/docs/en/hooks#stop
 *
 * Fires when Claude finishes responding (end of a turn).
 *
 * Stdin payload fields:
 *   session_id              string
 *   hook_event_name         string — "Stop"
 *   cwd                     string
 *   transcript_path         string
 *   permission_mode         string
 *   agent_id                string?
 *   last_assistant_message  string?
 *   stop_reason             string?
 *
 * Blocking: Yes (exit 2 / decision: "block"). This handler never blocks.
 *
 * Records the assistant's response. When agent_id is present (subagent turn),
 * runtime-session-end is skipped — SubagentStop.ts handles child completion.
 */
import {createMessageId, ellipsize} from "~claude-code/hooks/util/utils.js";
import {CLAUDE_RUNTIME_SOURCE} from "~claude-code/hooks/util/paths.const.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {postJson} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readStop} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type AssistantResponseMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("Stop", {
    logger: claudeHookRuntime.logger,
    parse: readStop,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const stopReason = payload.stopReason ?? "end_turn";
        const title = payload.lastAssistantMessage
            ? ellipsize(payload.lastAssistantMessage, 120)
            : `Response (${stopReason})`;

        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const metadata: AssistantResponseMetadata = {
            ...provenEvidence("Emitted by the Stop hook."),
            messageId: createMessageId(),
            source: CLAUDE_RUNTIME_SOURCE,
            stopReason,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.assistantResponse,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.user,
            title,
            ...(payload.lastAssistantMessage ? {body: payload.lastAssistantMessage} : {}),
            metadata,
        });

        if (payload.agentId) return;

        await postJson("/api/runtime-session-end", {
            runtimeSource: CLAUDE_RUNTIME_SOURCE,
            runtimeSessionId: payload.sessionId,
            summary: `Assistant turn completed (${stopReason})`,
            completeTask: false,
            completionReason: "assistant_turn_complete",
        });
    },
});

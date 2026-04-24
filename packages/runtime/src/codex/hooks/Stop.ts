/**
 * Codex Hook: Stop
 *
 * Ref: https://developers.openai.com/codex/hooks#stop
 *
 * Stdin payload fields:
 *   session_id             string
 *   cwd                    string
 *   hook_event_name        string — "Stop"
 *   model                  string
 *   turn_id                string
 *   stop_hook_active       boolean
 *   last_assistant_message string
 *
 * Blocking: Yes (decision: "block" continues with auto-generated prompt).
 * This handler never blocks.
 *
 * Unlike Claude Code, Codex does not expose a `stop_reason`. A synthetic
 * "stop_hook" value is used as the stopReason field in emitted metadata.
 */
import {createMessageId, ellipsize} from "~codex/util/utils.js";
import {CODEX_RUNTIME_SOURCE} from "~codex/util/paths.const.js";
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession, postJson} from "~codex/lib/transport/transport.js";
import {readCodexStop} from "~shared/hooks/codex/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type AssistantResponseMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {writeLatestSessionState} from "~codex/util/session.state.js";

await runHook("Stop", {
    logger: codexHookRuntime.logger,
    parse: readCodexStop,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const stopReason = "stop_hook";
        const title = payload.lastAssistantMessage
            ? ellipsize(payload.lastAssistantMessage, 120)
            : `Response (${stopReason})`;

        const ids = await ensureRuntimeSession(payload.sessionId);
        const metadata: AssistantResponseMetadata = {
            ...provenEvidence("Emitted by the Codex Stop hook."),
            messageId: createMessageId(),
            source: CODEX_RUNTIME_SOURCE,
            stopReason,
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.assistantResponse,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.user,
            title,
            ...(payload.lastAssistantMessage ? {body: payload.lastAssistantMessage} : {}),
            metadata,
        });

        await postJson("/api/runtime-session-end", {
            runtimeSource: CODEX_RUNTIME_SOURCE,
            runtimeSessionId: payload.sessionId,
            summary: `Assistant turn completed (${stopReason})`,
            completeTask: true,
            completionReason: "assistant_turn_complete",
        });

        await writeLatestSessionState({
            sessionId: payload.sessionId,
            ...(payload.model ? {modelId: payload.model} : {}),
            source: "stop",
        }).catch(() => undefined);
    },
});

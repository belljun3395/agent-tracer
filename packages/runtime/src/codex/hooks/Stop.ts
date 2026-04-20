/**
 * Codex Hook: Stop
 *
 * Fires when the Codex model finishes responding (end of a turn).
 * No matcher — fires on every turn completion.
 *
 * Stdin payload fields (ref: https://github.com/openai/codex#hooks):
 *   session_id             string  — unique session / thread identifier
 *   hook_event_name        string  — "Stop"
 *   last_assistant_message string? — the final assistant message text
 *   model                  string? — model identifier used for the turn
 *
 * Stdout: not consumed by Codex for Stop hooks.
 *
 * Blocking: Stop hooks cannot block execution in Codex.
 *
 * This handler:
 *   1. Posts an assistantResponse event with the final message text.
 *   2. Calls /api/runtime-session-end to mark the turn complete in the monitor.
 *   3. Updates the latest-session hint with the most recent model identifier.
 *
 * NOTE: Unlike Claude Code, Codex does not expose a stop_reason in the hook
 * payload. A synthetic "stop_hook" value is used as the stopReason field in
 * the emitted event metadata.
 */
import {createMessageId, ellipsize, toTrimmedString} from "~codex/util/utils.js";
import {CODEX_RUNTIME_SOURCE} from "~codex/util/paths.const.js";
import {readHookSessionContext} from "~codex/lib/hook/hook.context.js";
import {ensureRuntimeSession, postJson, postTaggedEvent} from "~codex/lib/transport/transport.js";
import {KIND} from "~shared/events/kinds.js";
import {type AssistantResponseMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {hookLog} from "~codex/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";
import {writeLatestSessionState} from "~codex/util/session.state.js";

async function main(): Promise<void> {
    const {payload, sessionId} = await readHookSessionContext("Stop");
    if (!sessionId) {
        hookLog("Stop", "skipped — no sessionId");
        return;
    }

    const responseText = toTrimmedString(payload.last_assistant_message);
    const modelId = toTrimmedString(payload.model);
    const stopReason = "stop_hook";

    const title = responseText
        ? ellipsize(responseText, 120)
        : `Response (${stopReason})`;

    const ids = await ensureRuntimeSession(sessionId);

    const baseMeta: AssistantResponseMetadata = {
        ...provenEvidence("Emitted by the Codex Stop hook."),
        messageId: createMessageId(),
        source: CODEX_RUNTIME_SOURCE,
        stopReason,
    };
    await postTaggedEvent({
        kind: KIND.assistantResponse,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.user,
        title,
        ...(responseText ? {body: responseText} : {}),
        metadata: baseMeta,
    });
    hookLog("Stop", "assistant-response posted", {stopReason, hasText: !!responseText});

    await postJson("/api/runtime-session-end", {
        runtimeSource: CODEX_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        summary: `Assistant turn completed (${stopReason})`,
        completeTask: true,
        completionReason: "assistant_turn_complete",
    });
    hookLog("Stop", "runtime-session-end posted", {stopReason, completeTask: true});

    await writeLatestSessionState({
        sessionId,
        ...(modelId ? {modelId} : {}),
        source: "stop",
    }).catch(() => undefined);
}

void main().catch((err: unknown) => {
    hookLog("Stop", "ERROR", {error: String(err)});
});

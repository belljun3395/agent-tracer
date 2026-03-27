/**
 * Stop hook — fires when a conversation turn ends.
 *
 * Codex Stop payload (JSON output only) observed in practice:
 *   session_id, cwd, model, hook_event_name, last_assistant_message, stop_reason
 * Optional fields like turn_id / transcript_path may be absent.
 *
 * Output: JSON { continue, stopReason, systemMessage, suppressOutput }
 * Returning exit 0 with no output = success (continue).
 * Returning exit 2 on stderr = block (re-prompt with reason).
 */
import {
    CODEX_RUNTIME_SOURCE,
    createMessageId,
    ellipsize,
    ensureRuntimeSession,
    getSessionId,
    hookLog,
    hookLogPayload,
    postJson,
    readStdinJson,
    setProjectDir,
    toTrimmedString
} from "./common.js";
import { backfillTurnEventsFromTranscript } from "./transcript_backfill.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("stop", payload);

    const cwd = toTrimmedString(payload.cwd);
    if (cwd) setProjectDir(cwd);

    const sessionId = getSessionId(payload);
    if (!sessionId) {
        hookLog("stop", "skipped — no sessionId");
        return;
    }

    const stopReason = toTrimmedString(payload.stop_reason) || "end_turn";
    const responseText = toTrimmedString(payload.last_assistant_message) || "";
    const title = responseText
        ? ellipsize(responseText, 120)
        : `Response (${stopReason})`;
    const ids = await ensureRuntimeSession(sessionId);

    const usage = payload.usage as Record<string, unknown> | undefined;

    try {
        await backfillTurnEventsFromTranscript(payload, ids);
    } catch (error) {
        hookLog("stop", "transcript backfill failed", { error: String(error) });
    }

    await postJson("/api/assistant-response", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        messageId: createMessageId(),
        source: CODEX_RUNTIME_SOURCE,
        title,
        ...(responseText ? { body: responseText } : {}),
        metadata: {
            stopReason,
            ...(usage?.input_tokens != null ? { inputTokens: usage.input_tokens } : {}),
            ...(usage?.output_tokens != null ? { outputTokens: usage.output_tokens } : {}),
            ...(usage?.cache_read_input_tokens != null ? { cacheReadTokens: usage.cache_read_input_tokens } : {}),
            ...(usage?.cache_creation_input_tokens != null ? { cacheCreateTokens: usage.cache_creation_input_tokens } : {})
        }
    });
    hookLog("stop", "assistant-response posted", { stopReason, hasText: !!responseText });

    // Mark the task complete for this turn.
    await postJson("/api/runtime-session-end", {
        runtimeSource: CODEX_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        completeTask: true,
        completionReason: "assistant_turn_complete",
        summary: responseText ? ellipsize(responseText, 200) : undefined
    });

    hookLog("stop", "task completed", { taskId: ids.taskId, stopReason });
}

void main().catch((err: unknown) => {
    hookLog("stop", "ERROR", { error: String(err) });
});

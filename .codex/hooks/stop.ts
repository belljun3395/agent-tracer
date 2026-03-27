/**
 * Stop hook — fires when a conversation turn ends.
 *
 * Codex Stop payload (JSON output only):
 *   session_id, cwd, model, turn_id, hook_event_name
 *
 * Output: JSON { continue, stopReason, systemMessage, suppressOutput }
 * Returning exit 0 with no output = success (continue).
 * Returning exit 2 on stderr = block (re-prompt with reason).
 */
import {
    CODEX_RUNTIME_SOURCE,
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

    const ids = await ensureRuntimeSession(sessionId);

    await backfillTurnEventsFromTranscript(payload, ids);

    // Mark the task complete for this turn.
    await postJson("/api/runtime-session-end", {
        runtimeSource: CODEX_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        completeTask: true,
        completionReason: "assistant_turn_complete",
        summary: undefined
    });

    hookLog("stop", "task completed", { taskId: ids.taskId });
}

void main().catch((err: unknown) => {
    hookLog("stop", "ERROR", { error: String(err) });
});

import { CLAUDE_RUNTIME_SOURCE, deleteCachedSessionResult, getSessionId, hookLog, hookLogPayload, readStdinJson, toTrimmedString, postJson } from "./common.js";
function mapCompletionReason(reason: string): "explicit_exit" | "runtime_terminated" {
    return reason === "prompt_input_exit" ? "explicit_exit" : "runtime_terminated";
}
async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("session_end", payload);
    const sessionId = getSessionId(payload);
    if (!sessionId)
        return;
    const reason = toTrimmedString(payload.reason) || "other";
    hookLog("session_end", "fired", { sessionId, reason });
    if (reason === "clear") {
        hookLog("session_end", "skipped — clear event handled by session_start");
        return;
    }
    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        summary: `Claude Code session ended (${reason})`,
        completionReason: mapCompletionReason(reason)
    });
    hookLog("session_end", "runtime-session-end posted", { reason });
    deleteCachedSessionResult(sessionId);
    hookLog("session_end", "session cache cleared", { sessionId });
}
void main().catch((err: unknown) => {
    hookLog("session_end", "ERROR", { error: String(err) });
});

/**
 * Claude Code Hook: SessionEnd
 *
 * Fires when a session terminates. Supported matchers (end reasons):
 *   "clear"             — /clear command; NOTE: SessionStart fires immediately after
 *   "resume"            — session was superseded by a resume
 *   "logout"            — user logged out
 *   "prompt_input_exit" — user typed /exit or closed the session explicitly
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#other-events):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "SessionEnd"
 *   reason           string  — one of the end reasons listed above
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *
 * Blocking: SessionEnd cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler:
 * 1. Posts a runtime-session-end event to the Agent Tracer monitor
 * 2. Clears the in-process session cache
 * 3. Persists the session record to ~/.claude/.session-history.json for resume support
 *
 * "clear" events are intentionally skipped because SessionStart handles them.
 */
import {
    CLAUDE_RUNTIME_SOURCE,
    deleteCachedSessionResult,
    getSessionId,
    hookLog,
    hookLogPayload,
    readStdinJson,
    toTrimmedString,
    postJson,
    getCachedSessionResult,
    createResumeId,
    appendSessionRecord,
    getSessionMetadata,
    deleteSessionMetadata
} from "./common.js";

function mapCompletionReason(reason: string): "explicit_exit" | "runtime_terminated" {
    return reason === "prompt_input_exit" ? "explicit_exit" : "runtime_terminated";
}

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("SessionEnd", payload);
    const sessionId = getSessionId(payload);
    if (!sessionId) return;

    const reason = toTrimmedString(payload.reason) || "other";
    hookLog("SessionEnd", "fired", { sessionId, reason });

    if (reason === "clear") {
        hookLog("SessionEnd", "skipped — clear event handled by SessionStart");
        return;
    }

    const endedAt = Date.now();
    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        summary: `Claude Code session ended (${reason})`,
        completionReason: mapCompletionReason(reason)
    });
    hookLog("SessionEnd", "runtime-session-end posted", { reason });

    deleteCachedSessionResult(sessionId);
    hookLog("SessionEnd", "session cache cleared", { sessionId });

    const cached = getCachedSessionResult(sessionId);
    const metadata = getSessionMetadata(sessionId);
    if (cached && metadata) {
        const projectDir = metadata.projectDir || toTrimmedString(payload.cwd) || process.cwd();
        const resumeId = createResumeId(CLAUDE_RUNTIME_SOURCE, sessionId);
        appendSessionRecord({
            resumeId,
            sessionId,
            runtimeSource: CLAUDE_RUNTIME_SOURCE,
            taskId: cached.taskId,
            projectDir,
            startedAt: metadata.startedAt,
            endedAt,
            reason
        });
        hookLog("SessionEnd", "session record persisted", { resumeId });
    } else {
        hookLog("SessionEnd", "skipped history persist — missing cached result or metadata");
    }

    deleteSessionMetadata(sessionId);
    hookLog("SessionEnd", "session metadata deleted", { sessionId });
}

void main().catch((err: unknown) => {
    hookLog("SessionEnd", "ERROR", { error: String(err) });
});

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
 * 2. Emits a session.ended timeline event so the dashboard records the lifecycle moment
 * 3. Clears the in-process session cache
 * 4. Persists the session record to ~/.claude/.session-history.json for resume support
 *
 * "clear" events are intentionally skipped because SessionStart handles them.
 */
import {
    CLAUDE_RUNTIME_SOURCE,
    deleteCachedSessionResult,
    deleteCursor,
    getSessionId,
    hookLog,
    hookLogPayload,
    LANE,
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

function buildSessionEndedTitle(reason: string): string {
    switch (reason) {
        case "prompt_input_exit":
            return "Session ended (user exit)";
        case "logout":
            return "Session ended (logout)";
        case "resume":
            return "Session ended (superseded by resume)";
        default:
            return `Session ended (${reason})`;
    }
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
    // Read cached IDs + metadata BEFORE clearing them so we can emit the
    // session.ended timeline event and persist the session-history record.
    const cached = getCachedSessionResult(sessionId);
    const metadata = getSessionMetadata(sessionId);
    const durationMs = metadata ? Math.max(0, endedAt - metadata.startedAt) : undefined;
    const transcriptPath = toTrimmedString(payload.transcript_path);
    const permissionMode = toTrimmedString(payload.permission_mode);
    const cwd = toTrimmedString(payload.cwd);

    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        summary: `Claude Code session ended (${reason})`,
        completionReason: mapCompletionReason(reason)
    });
    hookLog("SessionEnd", "runtime-session-end posted", { reason });

    if (cached) {
        const metadataPayload: Record<string, unknown> = {
            reason,
            completionReason: mapCompletionReason(reason),
            source: "session-end",
            sessionEndedAt: new Date(endedAt).toISOString()
        };
        if (typeof durationMs === "number") metadataPayload["durationMs"] = durationMs;
        if (metadata?.startedAt) metadataPayload["sessionStartedAt"] = new Date(metadata.startedAt).toISOString();
        if (transcriptPath) metadataPayload["transcriptPath"] = transcriptPath;
        if (permissionMode) metadataPayload["permissionMode"] = permissionMode;
        if (cwd) metadataPayload["cwd"] = cwd;

        await postJson("/ingest/v1/events", {
            events: [{
                kind: "session.ended",
                taskId: cached.taskId,
                sessionId: cached.sessionId,
                title: buildSessionEndedTitle(reason),
                body: `Claude Code session ended (${reason}).`,
                lane: LANE.user,
                metadata: metadataPayload
            }]
        });
        hookLog("SessionEnd", "session-ended event posted", { reason });
    } else {
        hookLog("SessionEnd", "skipped session-ended event — no cached runtime session");
    }

    if (cached && metadata) {
        const projectDir = metadata.projectDir || cwd || process.cwd();
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

    deleteCachedSessionResult(sessionId);
    hookLog("SessionEnd", "session cache cleared", { sessionId });

    deleteSessionMetadata(sessionId);
    hookLog("SessionEnd", "session metadata deleted", { sessionId });

    deleteCursor(sessionId);
    hookLog("SessionEnd", "transcript cursor deleted", { sessionId });
}

void main().catch((err: unknown) => {
    hookLog("SessionEnd", "ERROR", { error: String(err) });
});

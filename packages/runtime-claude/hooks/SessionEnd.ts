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
 * 1. Re-ensures the runtime session so we can emit a session.ended timeline event
 * 2. Posts runtime-session-end (server persists lifecycle + any resume state)
 * 3. Deletes the transcript cursor (only surviving plugin-local state)
 *
 * Phase 6 removed the on-disk session cache, metadata file, and session history.
 * The server already has startedAt from the original ensure call, so it can
 * derive duration from its own record if needed; the plugin no longer ships it.
 *
 * "clear" events are intentionally skipped because SessionStart handles them.
 */
import {
    getSessionId,
    toTrimmedString,
} from "./util/utils.js";
import { CLAUDE_RUNTIME_SOURCE } from "./util/paths.js";
import { LANE } from "./util/lane.js";
import { postJson, readStdinJson } from "./lib/transport.js";
import { resolveSessionIds } from "./lib/session.js";
import { deleteCursor } from "./lib/transcript-cursor.js";
import { deleteTodoState } from "./lib/todo-state.js";
import { hookLog, hookLogPayload } from "./lib/hook-log.js";

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
    const transcriptPath = toTrimmedString(payload.transcript_path);
    const permissionMode = toTrimmedString(payload.permission_mode);
    const cwd = toTrimmedString(payload.cwd);

    // Re-ensure the runtime session so we have (taskId, sessionId) for the
    // session.ended timeline event. The server's ensure use case is idempotent,
    // so this returns the same pair the session was created with.
    const ids = await resolveSessionIds(sessionId);

    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        summary: `Claude Code session ended (${reason})`,
        completionReason: mapCompletionReason(reason),
        ...(reason === "prompt_input_exit" ? { completeTask: true } : {})
    });
    hookLog("SessionEnd", "runtime-session-end posted", { reason });

    const metadataPayload: Record<string, unknown> = {
        reason,
        completionReason: mapCompletionReason(reason),
        source: "session-end",
        sessionEndedAt: new Date(endedAt).toISOString()
    };
    if (transcriptPath) metadataPayload["transcriptPath"] = transcriptPath;
    if (permissionMode) metadataPayload["permissionMode"] = permissionMode;
    if (cwd) metadataPayload["cwd"] = cwd;

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "session.ended",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title: buildSessionEndedTitle(reason),
            body: `Claude Code session ended (${reason}).`,
            lane: LANE.user,
            metadata: metadataPayload
        }]
    });
    hookLog("SessionEnd", "session-ended event posted", { reason });

    deleteCursor(sessionId);
    deleteTodoState(sessionId);
    hookLog("SessionEnd", "transcript cursor and todo state deleted", { sessionId });
}

void main().catch((err: unknown) => {
    hookLog("SessionEnd", "ERROR", { error: String(err) });
});

/**
 * Claude Code Hook: SessionStart
 *
 * Fires when a session begins or resumes. Supported matchers:
 *   "startup"  — brand-new session
 *   "resume"   — continuing a previous session
 *   "clear"    — conversation was cleared (/clear)
 *   "compact"  — session resumed after context compaction
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#sessionstart):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "SessionStart"
 *   source           string  — one of: startup | resume | clear | compact
 *   model            string  — e.g. "claude-sonnet-4-6"
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *   agent_type       string? — subagent type when agent_id is present
 *
 * Stdout (optional JSON on exit 0):
 *   hookSpecificOutput.additionalContext  string  — injected into conversation context
 *
 * Blocking: SessionStart cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler creates or resumes the runtime session in the Agent Tracer monitor
 * and posts a save-context event recording the session lifecycle trigger.
 */
import { LANE } from "./util/lane.js";
import { getSessionId, toTrimmedString } from "./util/utils.js";
import { postJson, readStdinJson } from "./lib/transport.js";
import { resolveSessionIds } from "./lib/session.js";
import { saveSessionMetadata } from "./lib/session-metadata.js";
import { hookLog, hookLogPayload } from "./lib/hook-log.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("SessionStart", payload);
    const sessionId = getSessionId(payload);
    const source = toTrimmedString(payload.source).toLowerCase();
    hookLog("SessionStart", "fired", { sessionId: sessionId || "(none)", source });

    const TITLES: Record<string, string> = {
        startup: "Session started",
        resume: "Session resumed",
        clear: "Conversation cleared",
        compact: "Session resumed after compact"
    };
    const BODIES: Record<string, string> = {
        startup: "Claude Code session started.",
        resume: "Claude Code session resumed.",
        clear: "Claude Code conversation was cleared (/clear).",
        compact: "Claude Code session resumed after context compaction."
    };

    if (!sessionId || !(source in TITLES)) {
        hookLog("SessionStart", "skipped — no sessionId or unknown source");
        return;
    }

    const ids = await resolveSessionIds(sessionId);
    hookLog("SessionStart", "ensureRuntimeSession ok", { taskId: ids.taskId });

    const projectDir = toTrimmedString(payload.cwd) || process.cwd();
    saveSessionMetadata({
        sessionId,
        startedAt: Date.now(),
        source,
        projectDir
    });
    hookLog("SessionStart", "session metadata saved", { source, projectDir });

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "context.saved",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title: TITLES[source],
            body: BODIES[source],
            lane: LANE.planning,
            metadata: { trigger: source }
        }]
    });
    hookLog("SessionStart", "save-context posted", { title: TITLES[source] });
}

void main().catch((err: unknown) => {
    hookLog("SessionStart", "ERROR", { error: String(err) });
});

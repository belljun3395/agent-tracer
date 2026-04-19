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
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ContextSavedMetadata} from "~shared/events/metadata.js";
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readHookSessionContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {ensureRuntimeSession, postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";

async function main(): Promise<void> {
    const {payload, sessionId} = await readHookSessionContext("SessionStart");
    const source = toTrimmedString(payload.source).toLowerCase();
    hookLog("SessionStart", "fired", {sessionId: sessionId || "(none)", source});

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

    const ids = await ensureRuntimeSession(sessionId);
    hookLog("SessionStart", "ensureRuntimeSession ok", {taskId: ids.taskId});

    const baseMeta: ContextSavedMetadata = {
        ...provenEvidence("Emitted by the SessionStart hook."),
        trigger: source,
    };
    await postTaggedEvent({
        kind: KIND.contextSaved,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: TITLES[source]!,
        body: BODIES[source]!,
        lane: LANE.planning,
        metadata: baseMeta,
    });
    hookLog("SessionStart", "save-context posted", {title: TITLES[source]});
}

void main().catch((err: unknown) => {
    hookLog("SessionStart", "ERROR", {error: String(err)});
});

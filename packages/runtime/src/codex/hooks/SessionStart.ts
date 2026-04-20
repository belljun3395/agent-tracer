/**
 * Codex Hook: SessionStart
 *
 * Fires when a Codex CLI session begins or resumes.
 * Matcher (hooks.json): "startup|resume"
 *   "startup" — brand-new session
 *   "resume"  — continuing a previous session
 *
 * Stdin payload fields (ref: https://github.com/openai/codex#hooks):
 *   session_id       string  — unique session / thread identifier
 *   hook_event_name  string  — "SessionStart"
 *   source           string  — one of: startup | resume
 *   model            string? — e.g. "o4-mini"
 *
 * Stdout: not consumed by Codex for SessionStart.
 *
 * Blocking: SessionStart cannot block execution.
 *
 * This handler:
 *   1. Creates or resumes the runtime session in the Agent Tracer monitor.
 *   2. Posts a contextSaved event recording the session lifecycle trigger.
 *   3. Persists a latest-session hint to .codex/agent-tracer/latest-session.json.
 *   4. Launches the observer process (observe.ts) in the background if not running.
 */
import { ensureRuntimeSession, postTaggedEvent, readStdinJson } from "~codex/lib/transport/transport.js";
import { KIND } from "~shared/events/kinds.js";
import { LANE } from "~shared/events/lanes.js";
import { provenEvidence } from "~shared/semantics/evidence.js";
import { ensureObserverRunning } from "~codex/util/observer.js";
import { toTrimmedString } from "~codex/util/utils.js";
import { writeLatestSessionState } from "~codex/util/session.state.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    const source = toTrimmedString(payload.source).toLowerCase();
    const modelId = toTrimmedString(payload.model);
    if (!sessionId || (source !== "startup" && source !== "resume")) return;

    const ids = await ensureRuntimeSession(sessionId);
    const title = source === "resume" ? "Session resumed" : "Session started";
    const body = source === "resume" ? "Codex CLI session resumed." : "Codex CLI session started.";

    await postTaggedEvent({
        kind: KIND.contextSaved,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title,
        body,
        lane: LANE.planning,
        metadata: {
            ...provenEvidence("Emitted by the Codex SessionStart hook."),
            trigger: source,
        },
    });

    await writeLatestSessionState({
        sessionId,
        ...(modelId ? { modelId } : {}),
        source,
    }).catch(() => undefined);
    await ensureObserverRunning(sessionId).catch(() => undefined);
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

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
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ContextSavedMetadata} from "~shared/events/metadata.js";
import {toTrimmedString} from "~codex/util/utils.js";
import {readHookSessionContext} from "~codex/lib/hook/hook.context.js";
import {ensureRuntimeSession, postTaggedEvent} from "~codex/lib/transport/transport.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {hookLog} from "~codex/lib/hook/hook.log.js";
import {ensureObserverRunning} from "~codex/util/observer.js";
import {writeLatestSessionState} from "~codex/util/session.state.js";

async function main(): Promise<void> {
    const {payload, sessionId} = await readHookSessionContext("SessionStart");
    const source = toTrimmedString(payload.source).toLowerCase();
    const modelId = toTrimmedString(payload.model);
    hookLog("SessionStart", "fired", {sessionId: sessionId || "(none)", source});

    if (!sessionId || (source !== "startup" && source !== "resume")) {
        hookLog("SessionStart", "skipped — no sessionId or unknown source");
        return;
    }

    const TITLES: Record<string, string> = {
        startup: "Session started",
        resume: "Session resumed",
    };
    const BODIES: Record<string, string> = {
        startup: "Codex CLI session started.",
        resume: "Codex CLI session resumed.",
    };

    const ids = await ensureRuntimeSession(sessionId);
    hookLog("SessionStart", "ensureRuntimeSession ok", {taskId: ids.taskId});

    const baseMeta: ContextSavedMetadata = {
        ...provenEvidence("Emitted by the Codex SessionStart hook."),
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

    await writeLatestSessionState({
        sessionId,
        ...(modelId ? {modelId} : {}),
        source,
    }).catch(() => undefined);
    await ensureObserverRunning(sessionId, undefined, modelId || undefined).catch(() => undefined);
}

void main().catch((err: unknown) => {
    hookLog("SessionStart", "ERROR", {error: String(err)});
});

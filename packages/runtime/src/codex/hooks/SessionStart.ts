/**
 * Codex Hook: SessionStart — matcher: "startup|resume"
 *
 * Ref: https://developers.openai.com/codex/hooks#sessionstart
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "SessionStart"
 *   source           string — startup | resume
 *   cwd              string
 *   transcript_path  string
 *   model            string
 *
 * Blocking: Yes (continue: false).
 *
 * Creates or resumes the runtime session, posts a contextSaved event, and
 * launches the rollout observer process in the background.
 */
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {readCodexSessionStart} from "~shared/hooks/codex/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ContextSavedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {ensureObserverRunning} from "~codex/util/observer.js";
import {writeLatestSessionState} from "~codex/util/session.state.js";

const TITLES: Record<string, string> = {
    startup: "Session started",
    resume: "Session resumed",
};
const BODIES: Record<string, string> = {
    startup: "Codex CLI session started.",
    resume: "Codex CLI session resumed.",
};

await runHook("SessionStart", {
    logger: codexHookRuntime.logger,
    parse: readCodexSessionStart,
    handler: async (payload) => {
        const source = (payload.source ?? "").toLowerCase();
        if (!payload.sessionId || (source !== "startup" && source !== "resume")) return;

        const ids = await ensureRuntimeSession(payload.sessionId);
        const metadata: ContextSavedMetadata = {
            ...provenEvidence("Emitted by the Codex SessionStart hook."),
            trigger: source,
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.contextSaved,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title: TITLES[source]!,
            body: BODIES[source]!,
            lane: LANE.planning,
            metadata,
        });

        await writeLatestSessionState({
            sessionId: payload.sessionId,
            ...(payload.model ? {modelId: payload.model} : {}),
            source,
        }).catch(() => undefined);
        await ensureObserverRunning(payload.sessionId, undefined, payload.model).catch(() => undefined);
    },
});

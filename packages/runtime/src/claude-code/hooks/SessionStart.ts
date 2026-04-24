/**
 * Claude Code Hook: SessionStart
 *
 * Ref: https://code.claude.com/docs/en/hooks#sessionstart
 *
 * Matchers: "startup" | "resume" | "clear" | "compact"
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "SessionStart"
 *   source           string — startup | resume | clear | compact
 *   model            string
 *   cwd              string
 *   transcript_path  string
 *   permission_mode  string
 *   agent_id         string?
 *   agent_type       string?
 *
 * Blocking: No.
 *
 * Creates or resumes the runtime session in the Agent Tracer monitor and
 * posts a save-context event recording the lifecycle trigger.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {ensureRuntimeSession} from "~claude-code/hooks/lib/transport/transport.js";
import {readSessionStart} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ContextSavedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

const TITLES: Record<string, string> = {
    startup: "Session started",
    resume: "Session resumed",
    clear: "Conversation cleared",
    compact: "Session resumed after compact",
};
const BODIES: Record<string, string> = {
    startup: "Claude Code session started.",
    resume: "Claude Code session resumed.",
    clear: "Claude Code conversation was cleared (/clear).",
    compact: "Claude Code session resumed after context compaction.",
};

await runHook("SessionStart", {
    logger: claudeHookRuntime.logger,
    parse: readSessionStart,
    handler: async (payload) => {
        const source = payload.source.toLowerCase();
        if (!(source in TITLES)) return;

        const ids = await ensureRuntimeSession(payload.sessionId);
        const metadata: ContextSavedMetadata = {
            ...provenEvidence("Emitted by the SessionStart hook."),
            trigger: source,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.contextSaved,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title: TITLES[source]!,
            body: BODIES[source]!,
            lane: LANE.planning,
            metadata,
        });
    },
});

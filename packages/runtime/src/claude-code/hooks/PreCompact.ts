/**
 * Claude Code Hook: PreCompact
 *
 * Fires before context compaction begins.
 * Supported matchers: "manual" | "auto" (compaction trigger).
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#other-events):
 *   session_id           string  — unique session identifier
 *   hook_event_name      string  — "PreCompact"
 *   trigger              string  — "manual" or "auto"
 *   cwd                  string  — current working directory
 *   transcript_path      string  — path to the session transcript JSONL
 *   permission_mode      string  — current permission mode
 *
 * NOTE: The following field is used below but is NOT in the official schema.
 * It appears to be an implementation extension available in practice:
 *   custom_instructions  string? — custom instructions applied before compact
 *
 * Blocking: PreCompact cannot block (exit 2 shows stderr but execution continues).
 *           Ref: https://code.claude.com/docs/en/hooks#exit-code-2-behavior-matrix
 *
 * This handler records a pre-compaction marker in the Agent Tracer monitor
 * so the UI can mark compaction boundaries in the session timeline.
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
    const {payload, sessionId} = await readHookSessionContext("PreCompact");
    hookLog("PreCompact", "fired", {sessionId: sessionId || "(none)"});

    if (!sessionId) {
        hookLog("PreCompact", "skipped — no sessionId");
        return;
    }

    const ids = await ensureRuntimeSession(sessionId);
    const trigger = toTrimmedString(payload.trigger) || "auto";
    const customInstructions = toTrimmedString(payload.custom_instructions);

    const baseMeta: ContextSavedMetadata = {
        ...provenEvidence("Emitted by the PreCompact hook."),
        trigger,
        compactPhase: "before",
    };
    await postTaggedEvent({
        kind: KIND.contextSaved,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: "Context compacting",
        ...(customInstructions ? {body: customInstructions} : {}),
        lane: LANE.planning,
        metadata: baseMeta,
    });
    hookLog("PreCompact", "save-context posted", {trigger});
}

void main().catch((err: unknown) => {
    hookLog("PreCompact", "ERROR", {error: String(err)});
});

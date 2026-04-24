/**
 * Claude Code Hook: PreCompact
 *
 * Ref: https://code.claude.com/docs/en/hooks#precompact
 *
 * Fires before context compaction begins.
 *
 * Matchers: "manual" | "auto"
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "PreCompact"
 *   trigger          string — manual | auto
 *
 * Implementation extension (not in official schema, available in practice):
 *   custom_instructions  string? — custom instructions applied before compact
 *
 * Blocking: Yes (decision: "block"). This handler never blocks.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {ensureRuntimeSession} from "~claude-code/hooks/lib/transport/transport.js";
import {readPreCompact} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ContextSavedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("PreCompact", {
    logger: claudeHookRuntime.logger,
    parse: readPreCompact,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await ensureRuntimeSession(payload.sessionId);
        const customInstructions = toTrimmedString(payload.payload["custom_instructions"]);

        const metadata: ContextSavedMetadata = {
            ...provenEvidence("Emitted by the PreCompact hook."),
            trigger: payload.trigger,
            compactPhase: "before",
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.contextSaved,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title: "Context compacting",
            ...(customInstructions ? {body: customInstructions} : {}),
            lane: LANE.planning,
            metadata,
        });
    },
});

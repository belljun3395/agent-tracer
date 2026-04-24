/**
 * Claude Code Hook: PostToolBatch
 *
 * Ref: https://code.claude.com/docs/en/hooks#posttoolbatch
 *
 * Fires after all parallel tool calls in a batch resolve, before the next
 * model call. The hook sees the full set of tool_use_ids and tool_calls.
 * Observability value: boundary marker for parallel tool fan-out.
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "PostToolBatch"
 *   tool_use_ids     string[]
 *   tool_calls       [{ tool_name: string, tool_input: object }]
 *
 * Blocking: Yes (decision: "block"). This handler never blocks.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readPostToolBatch} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ContextSavedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("PostToolBatch", {
    logger: claudeHookRuntime.logger,
    parse: readPostToolBatch,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const batchSize = payload.toolCalls.length;
        const toolNames = payload.toolCalls.map((call) => call.toolName);

        const metadata: ContextSavedMetadata = {
            ...provenEvidence("Emitted by the PostToolBatch hook."),
            trigger: "tool_batch_completed",
            itemCount: batchSize,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.contextSaved,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.planning,
            title: `Parallel tool batch (${batchSize})`,
            body: toolNames.length > 0 ? `Tools: ${toolNames.join(", ")}` : `Batch of ${batchSize} tool calls`,
            metadata,
        });
    },
});

/**
 * Claude Code Hook: StopFailure
 *
 * Ref: https://code.claude.com/docs/en/hooks#stopfailure
 *
 * Fires when a turn ends due to an API error (rate_limit, authentication_failed,
 * billing_error, invalid_request, server_error, max_output_tokens, unknown).
 * Complements Stop.ts, which handles normal turn completions.
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "StopFailure"
 *   error_type       string
 *   error_message    string?
 *
 * Blocking: No (output ignored).
 */
import {CLAUDE_RUNTIME_SOURCE} from "~claude-code/hooks/util/paths.const.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readStopFailure} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { AssistantResponseMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {createMessageId} from "~claude-code/hooks/util/utils.js";

await runHook("StopFailure", {
    logger: claudeHookRuntime.logger,
    parse: readStopFailure,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);

        const metadata: AssistantResponseMetadata = {
            ...provenEvidence("Emitted by the StopFailure hook."),
            messageId: createMessageId(),
            source: CLAUDE_RUNTIME_SOURCE,
            stopReason: `error:${payload.errorType}`,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.assistantResponse,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.user,
            title: `Turn failed (${payload.errorType})`,
            ...(payload.errorMessage ? {body: payload.errorMessage} : {}),
            metadata,
        });
    },
});

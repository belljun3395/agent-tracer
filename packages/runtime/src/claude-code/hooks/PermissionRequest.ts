/**
 * Claude Code Hook: PermissionRequest
 *
 * Ref: https://code.claude.com/docs/en/hooks#permissionrequest
 *
 * Fires when a permission dialog is about to show to the user. Carries the
 * tool name + tool input that triggered the prompt and any auto-suggested
 * permission rules. Useful verification signal — "agent attempted X but the
 * user had to approve it".
 *
 * Stdin payload fields:
 *   session_id              string
 *   hook_event_name         string — "PermissionRequest"
 *   tool_name               string
 *   tool_input              JSON
 *   permission_suggestions  array
 *
 * Blocking: Yes (decision: "deny" rejects). This handler always returns
 * exit 0 with no JSON output — it never overrides the user's choice.
 */
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readPermissionRequest} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { PermissionRequestMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

const SUMMARY_MAX = 400;

await runHook("PermissionRequest", {
    logger: claudeHookRuntime.logger,
    parse: readPermissionRequest,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const summary = JSON.stringify(stringifyToolInput(payload.toolInput)).slice(0, SUMMARY_MAX);

        const metadata: PermissionRequestMetadata = {
            ...provenEvidence("Observed directly by the PermissionRequest hook."),
            toolName: payload.toolName,
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
            ...(summary ? {toolInputSummary: summary} : {}),
            suggestionCount: payload.suggestionCount,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.permissionRequest,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.coordination,
            title: `Permission requested: ${payload.toolName}`,
            ...(summary ? {body: summary} : {}),
            metadata,
        });
    },
});

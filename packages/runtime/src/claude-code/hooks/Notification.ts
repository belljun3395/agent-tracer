/**
 * Claude Code Hook: Notification
 *
 * Ref: https://code.claude.com/docs/en/hooks#notification
 *
 * Fires when Claude Code emits a notification to the user (permission_prompt,
 * idle_prompt, auth_success, elicitation_dialog).
 *
 * Stdin payload fields:
 *   session_id            string
 *   hook_event_name       string — "Notification"
 *   notification_type     string
 *   notification_message  string?
 *
 * Blocking: No.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readNotification} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ContextSavedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("Notification", {
    logger: claudeHookRuntime.logger,
    parse: readNotification,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const type = payload.notificationType ?? "unknown";

        const metadata: ContextSavedMetadata = {
            ...provenEvidence("Emitted by the Notification hook."),
            trigger: `notification:${type}`,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.contextSaved,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.planning,
            title: `Notification: ${type}`,
            ...(payload.notificationMessage ? {body: payload.notificationMessage} : {}),
            metadata,
        });
    },
});

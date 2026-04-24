/**
 * Claude Code Hook: PermissionDenied
 *
 * Ref: https://code.claude.com/docs/en/hooks#permissiondenied
 *
 * Fires when a tool call is denied by the auto-mode classifier. The hook
 * records the denial as an observability event.
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "PermissionDenied"
 *   tool_name        string
 *   tool_input       object
 *
 * Blocking: No.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readPermissionDenied} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type RuleLoggedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";

await runHook("PermissionDenied", {
    logger: claudeHookRuntime.logger,
    parse: readPermissionDenied,
    handler: async (payload) => {
        if (!payload.sessionId || !payload.toolName) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);

        const metadata: RuleLoggedMetadata = {
            ...provenEvidence("Emitted by the PermissionDenied hook."),
            ruleStatus: "denied",
            ruleOutcome: "auto_deny",
            rulePolicy: "auto_mode_classifier",
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.ruleLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.rule,
            title: `Permission denied: ${payload.toolName}`,
            body: `Auto-mode denied ${payload.toolName}: ${JSON.stringify(stringifyToolInput(payload.toolInput)).slice(0, 400)}`,
            metadata,
        });
    },
});

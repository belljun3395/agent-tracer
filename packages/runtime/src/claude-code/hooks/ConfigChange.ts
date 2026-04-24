/**
 * Claude Code Hook: ConfigChange
 *
 * Ref: https://code.claude.com/docs/en/hooks#configchange
 *
 * Fires when a settings source changes during a session
 * (user_settings, project_settings, local_settings, policy_settings, skills).
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "ConfigChange"
 *   config_source    string
 *
 * Blocking: Yes (except policy_settings). This handler never blocks.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readConfigChange} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ContextSavedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("ConfigChange", {
    logger: claudeHookRuntime.logger,
    parse: readConfigChange,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const source = payload.configSource ?? "unknown";

        const metadata: ContextSavedMetadata = {
            ...provenEvidence("Emitted by the ConfigChange hook."),
            trigger: `config_change:${source}`,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.contextSaved,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.planning,
            title: `Config changed: ${source}`,
            body: `Configuration source ${source} was updated during the session.`,
            metadata,
        });
    },
});

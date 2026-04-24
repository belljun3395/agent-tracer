/**
 * Codex Hook: PermissionRequest — matcher: "Bash"
 *
 * Ref: https://developers.openai.com/codex/hooks#permissionrequest
 *
 * Fires when Codex asks for permission to run a Bash command.
 * Observability-only: we log the request but never deny/allow from here.
 *
 * Stdin payload fields:
 *   session_id             string
 *   cwd                    string
 *   hook_event_name        string — "PermissionRequest"
 *   model                  string
 *   turn_id                string
 *   tool_name              string — "Bash"
 *   tool_input.command     string
 *   tool_input.description string?
 *
 * Stdout: JSON with `decision.behavior` (allow/deny) + optional `message`.
 *   This handler emits no decision (Codex uses its default policy).
 */
import {CODEX_RUNTIME_SOURCE} from "~codex/util/paths.const.js";
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {readCodexPermissionRequest} from "~shared/hooks/codex/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type RuleLoggedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {toTrimmedString} from "~codex/util/utils.js";

await runHook("PermissionRequest", {
    logger: codexHookRuntime.logger,
    parse: readCodexPermissionRequest,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await ensureRuntimeSession(payload.sessionId);
        const command = toTrimmedString(payload.toolInput["command"]);

        const metadata: RuleLoggedMetadata = {
            ...provenEvidence("Emitted by the Codex PermissionRequest hook."),
            ruleStatus: "requested",
            ruleOutcome: "observed",
            rulePolicy: "codex_permission",
            ruleSource: CODEX_RUNTIME_SOURCE,
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.ruleLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.rule,
            title: `Permission request: ${payload.toolName}`,
            ...(command || payload.description
                ? {body: payload.description ? `${payload.description}\n\n$ ${command}` : `$ ${command}`}
                : {}),
            metadata,
        });
    },
});

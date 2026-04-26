/**
 * Claude Code Hook: CwdChanged
 *
 * Ref: https://code.claude.com/docs/en/hooks#cwdchanged
 *
 * Fires when the working directory changes (e.g. `cd` command in Bash).
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "CwdChanged"
 *   old_cwd          string
 *   new_cwd          string
 *
 * Blocking: No.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readCwdChanged} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ContextSavedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("CwdChanged", {
    logger: claudeHookRuntime.logger,
    parse: readCwdChanged,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const oldCwd = payload.oldCwd ?? "";
        const newCwd = payload.newCwd ?? "";

        const metadata: ContextSavedMetadata = {
            ...provenEvidence("Emitted by the CwdChanged hook."),
            trigger: "cwd_changed",
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.contextSaved,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.planning,
            title: "Working directory changed",
            body: oldCwd && newCwd
                ? `${oldCwd} → ${newCwd}`
                : newCwd
                    ? `cwd set to ${newCwd}`
                    : "cwd changed",
            metadata,
        });
    },
});

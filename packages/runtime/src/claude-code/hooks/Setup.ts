/**
 * Claude Code Hook: Setup
 *
 * Ref: https://code.claude.com/docs/en/hooks#setup
 *
 * Fires when Claude Code is invoked with `--init-only`, `--init -p`, or
 * `--maintenance -p`. Useful as the "tracer was first wired up to this
 * project" timestamp.
 *
 * Stdin payload fields:
 *   session_id        string
 *   hook_event_name   string — "Setup"
 *   trigger           "init" | "maintenance"
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readSetup} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { SetupMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("Setup", {
    logger: claudeHookRuntime.logger,
    parse: readSetup,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const trigger = payload.trigger || "init";
        const title = trigger === "maintenance" ? "Setup: maintenance" : "Setup: init";

        const metadata: SetupMetadata = {
            ...provenEvidence("Observed directly by the Setup hook."),
            trigger,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.setupTriggered,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.planning,
            title,
            body: `Claude Code setup triggered (${trigger}).`,
            metadata,
        });
    },
});

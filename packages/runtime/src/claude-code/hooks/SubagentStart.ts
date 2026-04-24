/**
 * Claude Code Hook: SubagentStart
 *
 * Ref: https://code.claude.com/docs/en/hooks#subagentstart
 *
 * Fires when a subagent is spawned.
 *
 * Stdin payload fields:
 *   session_id       string — parent session
 *   hook_event_name  string — "SubagentStart"
 *   subagent_type    string
 *   agent_id         string — unique ID for the spawned agent
 *   cwd              string
 *
 * Blocking: No.
 *
 * Eagerly creates the background child task via resolveSubagentSessionIds so
 * subsequent subagent tool hooks hit the same virtual child session, then
 * posts an async-task "running" event to the parent task.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {ensureRuntimeSession} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveSubagentSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readSubagentStart} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type ActionLoggedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("SubagentStart", {
    logger: claudeHookRuntime.logger,
    parse: readSubagentStart,
    handler: async (payload) => {
        if (!payload.sessionId || !payload.agentId) return;

        const ids = await ensureRuntimeSession(payload.sessionId);
        const childIds = await resolveSubagentSessionIds(
            payload.sessionId,
            payload.agentId,
            payload.subagentType,
        );

        const metadata: ActionLoggedMetadata = {
            ...provenEvidence("Emitted by the SubagentStart hook."),
            asyncTaskId: payload.agentId,
            asyncStatus: "running",
            agentId: payload.agentId,
            agentType: payload.subagentType,
            parentTaskId: ids.taskId,
            parentSessionId: payload.sessionId,
            childTaskId: childIds.taskId,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.actionLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.background,
            title: `Subagent started: ${payload.subagentType}`,
            metadata,
        });
    },
});

/**
 * Claude Code Hook: SubagentStart
 *
 * Fires when a subagent is spawned. No matcher is supported — fires for every
 * subagent regardless of type.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#subagentstartstop):
 *   session_id       string  — parent session identifier
 *   hook_event_name  string  — "SubagentStart"
 *   agent_id         string  — unique ID for the spawned agent
 *   agent_type       string  — agent type name (e.g. "Explore", "code-reviewer")
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *
 * Stdout (optional JSON on exit 0):
 *   hookSpecificOutput.additionalContext  string  — injected into conversation context
 *
 * Blocking: SubagentStart cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler eagerly creates a background child task in the monitor via
 * resolveSubagentSessionIds so subsequent subagent tool hooks hit the same
 * virtual child session, then posts an async-task "running" event to the parent task.
 */
import {readHookSessionContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {ensureRuntimeSession, postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {KIND} from "~shared/events/kinds.js";
import {type ActionLoggedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {resolveSubagentSessionIds} from "~claude-code/hooks/Agent/session.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";

async function main(): Promise<void> {
    const {sessionId, agentId, agentType} = await readHookSessionContext("SubagentStart");
    const normalizedAgentId = agentId ?? "";
    const normalizedAgentType = agentType ?? "";
    hookLog("SubagentStart", "fired", {
        agentId: normalizedAgentId || "(none)",
        agentType: normalizedAgentType,
        sessionId: sessionId || "(none)"
    });

    if (!sessionId || !normalizedAgentId) {
        hookLog("SubagentStart", "skipped — missing sessionId or agentId");
        return;
    }

    const ids = await ensureRuntimeSession(sessionId);

    // Eagerly create the child background task so subsequent PostToolUse hooks
    // inside the subagent get a cache hit and route to the correct task.
    const childIds = await resolveSubagentSessionIds(sessionId, normalizedAgentId, normalizedAgentType);
    hookLog("SubagentStart", "child task created", {
        agentId: normalizedAgentId,
        childTaskId: childIds.taskId,
        childSessionId: childIds.sessionId,
        parentTaskId: ids.taskId
    });

    const baseMeta: ActionLoggedMetadata = {
        ...provenEvidence("Emitted by the SubagentStart hook."),
        asyncTaskId: normalizedAgentId,
        asyncStatus: "running",
        agentId: normalizedAgentId,
        agentType: normalizedAgentType,
        parentTaskId: ids.taskId,
        parentSessionId: sessionId,
        childTaskId: childIds.taskId,
    };
    await postTaggedEvent({
        kind: KIND.actionLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.background,
        title: `Subagent started: ${normalizedAgentType}`,
        metadata: baseMeta,
    });
    hookLog("SubagentStart", "async-task posted", {agentType: normalizedAgentType, agentId: normalizedAgentId});
}

void main().catch((err: unknown) => {
    hookLog("SubagentStart", "ERROR", {error: String(err)});
});

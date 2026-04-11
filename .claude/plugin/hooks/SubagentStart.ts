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
 * resolveSubagentSessionIds, stores the child taskId/sessionId in the registry
 * for reference, and posts an async-task "running" event to the parent task.
 */
import { getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, readSubagentRegistry, resolveSessionIds, resolveSubagentSessionIds, toTrimmedString, writeSubagentRegistry } from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("SubagentStart", payload);
    const sessionId = getSessionId(payload);
    const agentId = toTrimmedString(payload.agent_id);
    const agentType = typeof payload.agent_type === "string" ? payload.agent_type : "";
    hookLog("SubagentStart", "fired", { agentId: agentId || "(none)", agentType, sessionId: sessionId || "(none)" });

    if (!sessionId || !agentId) {
        hookLog("SubagentStart", "skipped — missing sessionId or agentId");
        return;
    }

    const ids = await resolveSessionIds(sessionId);

    // Eagerly create the child background task so subsequent PostToolUse hooks
    // inside the subagent get a cache hit and route to the correct task.
    const childIds = await resolveSubagentSessionIds(sessionId, agentId, agentType);
    hookLog("SubagentStart", "child task created", {
        agentId,
        childTaskId: childIds.taskId,
        childSessionId: childIds.sessionId,
        parentTaskId: ids.taskId
    });

    const registry = readSubagentRegistry();
    registry[agentId] = {
        parentSessionId: sessionId,
        parentTaskId: ids.taskId,
        childTaskId: childIds.taskId,
        childSessionId: childIds.sessionId,
        agentType,
        linked: true
    };
    writeSubagentRegistry(registry);

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "action.logged",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            asyncTaskId: agentId,
            asyncStatus: "running",
            title: `Subagent started: ${agentType}`,
            metadata: {
                agentId,
                agentType,
                parentTaskId: ids.taskId,
                parentSessionId: sessionId,
                childTaskId: childIds.taskId
            }
        }]
    });
    hookLog("SubagentStart", "async-task posted", { agentType, agentId });
}

void main().catch((err: unknown) => {
    hookLog("SubagentStart", "ERROR", { error: String(err) });
});

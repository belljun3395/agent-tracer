/**
 * Claude Code Hook: SubagentStop
 *
 * Fires when a subagent finishes. No matcher is supported — fires for every
 * subagent regardless of type.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#subagentstartstop):
 *   session_id              string  — parent session identifier
 *   hook_event_name         string  — "SubagentStop"
 *   agent_id                string  — unique ID of the finished agent
 *   agent_type              string  — agent type name
 *   stop_hook_active        boolean — whether the Stop hook is running for the subagent
 *   agent_transcript_path   string? — path to the subagent's transcript JSONL
 *   last_assistant_message  string? — last message from the subagent
 *   cwd                     string  — current working directory
 *   transcript_path         string  — path to the parent session transcript JSONL
 *
 * Stdout (optional JSON on exit 0):
 *   hookSpecificOutput.additionalContext  string  — injected into conversation context
 *
 * Blocking: SubagentStop CAN block (exit 2 prevents the subagent from completing).
 *           Ref: https://code.claude.com/docs/en/hooks#exit-code-2-behavior-matrix
 *
 * This handler:
 *   1. Posts an async-task "completed" event to the parent task.
 *   2. Ends the virtual monitor session for the subagent (sub--{agentId}) so the
 *      server can auto-complete the background child task.
 *   3. Cleans up the virtual session cache entry.
 *   4. Removes the registry entry written by SubagentStart.ts.
 */
import { CLAUDE_RUNTIME_SOURCE, deleteCachedSessionResult, getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, readSubagentRegistry, resolveSessionIds, toTrimmedString, writeSubagentRegistry } from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("SubagentStop", payload);
    const sessionId = getSessionId(payload);
    const agentId = toTrimmedString(payload.agent_id);
    const agentType = typeof payload.agent_type === "string" ? payload.agent_type : "";
    hookLog("SubagentStop", "fired", { agentId: agentId || "(none)", agentType, sessionId: sessionId || "(none)" });

    if (!sessionId || !agentId) {
        hookLog("SubagentStop", "skipped — missing sessionId or agentId");
        return;
    }

    const ids = await resolveSessionIds(sessionId);

    // Post "completed" async-task event to parent task for parent timeline visibility.
    await postJson("/ingest/v1/events", {
        events: [{
            kind: "action.logged",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            asyncTaskId: agentId,
            asyncStatus: "completed",
            title: `Subagent finished: ${agentType}`,
            ...(toTrimmedString(payload.last_assistant_message)
                ? { body: toTrimmedString(payload.last_assistant_message, 400) }
                : {}),
            metadata: {
                agentId,
                agentType,
                parentTaskId: ids.taskId,
                parentSessionId: sessionId
            }
        }]
    });
    hookLog("SubagentStop", "async-task posted", { agentType, agentId });

    // End the virtual session so the server auto-completes the background child task.
    const virtualId = `sub--${agentId}`;
    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: virtualId,
        summary: `Subagent finished: ${agentType}`,
        completeTask: false,
        completionReason: "assistant_turn_complete"
    });
    hookLog("SubagentStop", "virtual session ended", { virtualId });

    // Clean up virtual session cache so the ID can be reused by future agents.
    deleteCachedSessionResult(virtualId);

    // Remove registry entry.
    const registry = readSubagentRegistry();
    delete registry[agentId];
    writeSubagentRegistry(registry);
    hookLog("SubagentStop", "registry entry removed", { agentId });
}

void main().catch((err: unknown) => {
    hookLog("SubagentStop", "ERROR", { error: String(err) });
});

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
 * This handler removes the registry entry written by SubagentStart.ts and posts
 * an async-task "completed" event to the monitor.
 */
import { getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, readSubagentRegistry, resolveSessionIds, toTrimmedString, writeSubagentRegistry } from "./common.js";

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
    const registry = readSubagentRegistry();
    delete registry[agentId];
    writeSubagentRegistry(registry);
    hookLog("SubagentStop", "registry entry removed", { agentId });

    await postJson("/api/async-task", {
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
    });
    hookLog("SubagentStop", "async-task posted", { agentType, agentId });
}

void main().catch((err: unknown) => {
    hookLog("SubagentStop", "ERROR", { error: String(err) });
});

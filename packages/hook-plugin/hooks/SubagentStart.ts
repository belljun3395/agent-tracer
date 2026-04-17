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
import { getAgentContext, getSessionId } from "./util/utils.js";
import { postJson, readStdinJson } from "./lib/transport.js";
import { resolveSessionIds } from "./lib/session.js";
import { resolveSubagentSessionIds } from "./lib/subagent-session.js";
import { hookLog, hookLogPayload } from "./lib/hook-log.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("SubagentStart", payload);
    const sessionId = getSessionId(payload);
    const { agentId, agentType } = getAgentContext(payload);
    const normalizedAgentId = agentId ?? "";
    const normalizedAgentType = agentType ?? "";
    hookLog("SubagentStart", "fired", { agentId: normalizedAgentId || "(none)", agentType: normalizedAgentType, sessionId: sessionId || "(none)" });

    if (!sessionId || !normalizedAgentId) {
        hookLog("SubagentStart", "skipped — missing sessionId or agentId");
        return;
    }

    const ids = await resolveSessionIds(sessionId);

    // Eagerly create the child background task so subsequent PostToolUse hooks
    // inside the subagent get a cache hit and route to the correct task.
    const childIds = await resolveSubagentSessionIds(sessionId, normalizedAgentId, normalizedAgentType);
    hookLog("SubagentStart", "child task created", {
        agentId: normalizedAgentId,
        childTaskId: childIds.taskId,
        childSessionId: childIds.sessionId,
        parentTaskId: ids.taskId
    });

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "action.logged",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            asyncTaskId: normalizedAgentId,
            asyncStatus: "running",
            title: `Subagent started: ${normalizedAgentType}`,
            metadata: {
                agentId: normalizedAgentId,
                agentType: normalizedAgentType,
                parentTaskId: ids.taskId,
                parentSessionId: sessionId,
                childTaskId: childIds.taskId
            }
        }]
    });
    hookLog("SubagentStart", "async-task posted", { agentType: normalizedAgentType, agentId: normalizedAgentId });
}

void main().catch((err: unknown) => {
    hookLog("SubagentStart", "ERROR", { error: String(err) });
});

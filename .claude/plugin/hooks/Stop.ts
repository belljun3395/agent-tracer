/**
 * Claude Code Hook: Stop
 *
 * Fires when Claude finishes responding (end of a turn).
 * No matcher is supported — fires on every turn completion.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#stop):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "Stop"
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * NOTE: The following fields are used below but are NOT in the official schema.
 * They appear to be implementation extensions available in practice:
 *   stop_reason             string? — e.g. "end_turn", "max_tokens"
 *   last_assistant_message  string? — the final assistant message text
 *   usage                   object? — token usage counters:
 *     input_tokens                  number
 *     output_tokens                 number
 *     cache_read_input_tokens       number
 *     cache_creation_input_tokens   number
 *
 * Stdout (optional JSON on exit 0):
 *   decision  "block"  — prevents Claude from stopping (re-runs the turn)
 *   reason    string   — shown to user if blocked
 *
 * Blocking: Stop CAN block (exit 2 forces Claude to continue the turn).
 *           Ref: https://code.claude.com/docs/en/hooks#exit-code-2-behavior-matrix
 *
 * This handler records the assistant's response and token usage in the
 * Agent Tracer monitor via /api/assistant-response.
 * When agent_id is present (subagent turn), the response is recorded on the
 * child task timeline via resolveEventSessionIds, and runtime-session-end
 * is skipped (SubagentStop.ts handles child task completion).
 */
import { CLAUDE_RUNTIME_SOURCE, createMessageId, ellipsize, getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, resolveEventSessionIds, toTrimmedString } from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("Stop", payload);
    const sessionId = getSessionId(payload);
    if (!sessionId) {
        hookLog("Stop", "skipped — no sessionId");
        return;
    }

    const agentId = toTrimmedString(payload.agent_id) || undefined;
    const agentType = toTrimmedString(payload.agent_type) || undefined;
    const stopReason = toTrimmedString(payload.stop_reason) || "end_turn";
    const responseText = toTrimmedString(payload.last_assistant_message) || "";
    const title = responseText
        ? ellipsize(responseText, 120)
        : `Response (${stopReason})`;

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const usage = payload.usage as Record<string, unknown> | undefined;

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "assistant.response",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            messageId: createMessageId(),
            source: "claude-plugin",
            title,
            ...(responseText ? { body: responseText } : {}),
            metadata: {
                stopReason,
                ...(usage?.input_tokens != null ? { inputTokens: usage.input_tokens } : {}),
                ...(usage?.output_tokens != null ? { outputTokens: usage.output_tokens } : {}),
                ...(usage?.cache_read_input_tokens != null ? { cacheReadTokens: usage.cache_read_input_tokens } : {}),
                ...(usage?.cache_creation_input_tokens != null ? { cacheCreateTokens: usage.cache_creation_input_tokens } : {})
            }
        }]
    });
    hookLog("Stop", "assistant-response posted", { stopReason, hasText: !!responseText, agentId: agentId ?? "(none)" });

    if (agentId) {
        hookLog("Stop", "runtime-session-end skipped for subagent", { agentId });
        return;
    }

    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        summary: `Assistant turn completed (${stopReason})`,
        completeTask: true,
        completionReason: "assistant_turn_complete"
    });
    hookLog("Stop", "runtime-session-end posted", { stopReason, completeTask: true });
}

void main().catch((err: unknown) => {
    hookLog("Stop", "ERROR", { error: String(err) });
});

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
 *   last_assistant_message  string? — the final assistant message text
 *
 * NOTE: The current Claude Code version does NOT include usage or stop_reason
 * in the hook payload. Both are read from the transcript JSONL at transcript_path.
 * Each line in the transcript is a JSON object; the last entry with
 * message.role === "assistant" carries message.usage and message.stop_reason.
 *
 * After posting the primary assistant.response event we also tail the transcript
 * for new thinking blocks, intermediate narration text, and system-attached
 * context (task_reminder, plan_mode, skill_listing, deferred_tools_delta,
 * mcp_instructions_delta, nested_memory) — content hooks cannot see directly.
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
import {
    CLAUDE_RUNTIME_SOURCE,
    commitCursor,
    createMessageId,
    ellipsize,
    getSessionId,
    hookLog,
    hookLogPayload,
    postJson,
    readLastAssistantEntry,
    readStdinJson,
    resolveEventSessionIds,
    tailTranscriptAsEvents,
    toTrimmedString
} from "./common.js";
import type { TranscriptUsage } from "./common.js";

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
    const responseText = toTrimmedString(payload.last_assistant_message) || "";

    // Prefer usage/stop_reason from the transcript JSONL (the current Claude Code
    // version does not include these in the payload). Fall back to payload fields
    // so that integration tests that inject payload.usage still work correctly.
    const transcriptPath = toTrimmedString(payload.transcript_path);
    const lastEntry = transcriptPath ? readLastAssistantEntry(transcriptPath) : undefined;
    const stopReason = toTrimmedString(lastEntry?.message?.stop_reason) || toTrimmedString(payload.stop_reason) || "end_turn";
    const usage = lastEntry?.message?.usage ?? (payload.usage as TranscriptUsage | undefined);

    const title = responseText
        ? ellipsize(responseText, 120)
        : `Response (${stopReason})`;

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);

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
    hookLog("Stop", "assistant-response posted", { stopReason, hasText: !!responseText, agentId: agentId ?? "(none)", hasUsage: !!usage });

    // Tail the transcript for thinking/intermediate-text/attachment events that
    // hooks can't see directly. Failures here must not break the Stop hook.
    if (transcriptPath) {
        try {
            const { events, nextCursor, totalNewEntries } = tailTranscriptAsEvents(
                sessionId,
                transcriptPath,
                ids
            );
            if (events.length > 0) {
                await postJson("/ingest/v1/events", { events });
            }
            commitCursor(sessionId, nextCursor);
            hookLog("Stop", "transcript-tail emitted", {
                newEntries: totalNewEntries,
                events: events.length
            });
        } catch (err: unknown) {
            hookLog("Stop", "transcript-tail error", { error: String(err) });
        }
    }

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

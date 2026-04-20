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
 * NOTE: stop_reason is not in the hook payload — read from transcript JSONL
 * (last entry with message.role === "assistant"). Token usage is collected
 * independently via the OTLP exporter and is NOT read here.
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
 * This handler records the assistant's response in the Agent Tracer monitor.
 * Token usage is collected separately via the OTLP exporter (POST /v1/logs).
 * When agent_id is present (subagent turn), the response is recorded on the
 * child task timeline via resolveEventSessionIds, and runtime-session-end
 * is skipped (SubagentStop.ts handles child task completion).
 */
import {createMessageId, ellipsize, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {CLAUDE_RUNTIME_SOURCE} from "~claude-code/hooks/util/paths.const.js";
import {readHookSessionContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postJson, postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {KIND} from "~shared/events/kinds.js";
import {type AssistantResponseMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";

async function main(): Promise<void> {
    const {payload, sessionId, agentId, agentType} = await readHookSessionContext("Stop");
    if (!sessionId) {
        hookLog("Stop", "skipped — no sessionId");
        return;
    }

    const responseText = toTrimmedString(payload.last_assistant_message) || "";
    const stopReason = toTrimmedString(payload.stop_reason) || "end_turn";

    const title = responseText
        ? ellipsize(responseText, 120)
        : `Response (${stopReason})`;

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);

    const baseMeta: AssistantResponseMetadata = {
        ...provenEvidence("Emitted by the Stop hook."),
        messageId: createMessageId(),
        source: CLAUDE_RUNTIME_SOURCE,
        stopReason,
    };
    await postTaggedEvent({
        kind: KIND.assistantResponse,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.user,
        title,
        ...(responseText ? {body: responseText} : {}),
        metadata: baseMeta,
    });
    hookLog("Stop", "assistant-response posted", {stopReason, hasText: !!responseText, agentId: agentId ?? "(none)"});

    if (agentId) {
        hookLog("Stop", "runtime-session-end skipped for subagent", {agentId});
        return;
    }

    await postJson("/api/runtime-session-end", {
        runtimeSource: CLAUDE_RUNTIME_SOURCE,
        runtimeSessionId: sessionId,
        summary: `Assistant turn completed (${stopReason})`,
        completeTask: true,
        completionReason: "assistant_turn_complete"
    });
    hookLog("Stop", "runtime-session-end posted", {stopReason, completeTask: true});
}

void main().catch((err: unknown) => {
    hookLog("Stop", "ERROR", {error: String(err)});
});

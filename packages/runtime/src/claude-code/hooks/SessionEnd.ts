/**
 * Claude Code Hook: SessionEnd
 *
 * Ref: https://code.claude.com/docs/en/hooks#sessionend
 *
 * Matchers (end reasons): clear | resume | logout | prompt_input_exit |
 *                         bypass_permissions_disabled | other
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "SessionEnd"
 *   reason           string
 *   cwd              string
 *   transcript_path  string
 *   permission_mode  string
 *
 * Blocking: No.
 *
 * This handler:
 *   1. Re-ensures the runtime session (needed for session.ended event)
 *   2. Posts /api/runtime-session-end (server persists lifecycle state)
 *   3. Deletes the transcript cursor (only surviving plugin-local state)
 *
 * "clear" events are intentionally skipped because SessionStart handles them
 * via the matching "clear" matcher immediately after.
 */
import {CLAUDE_RUNTIME_SOURCE} from "~claude-code/hooks/util/paths.const.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {ensureRuntimeSession, postJson} from "~claude-code/hooks/lib/transport/transport.js";
import {readSessionEnd} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type SessionEndedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {deleteTodoState} from "~claude-code/hooks/PostToolUse/Todo/todo.state.js";

function mapCompletionReason(reason: string): "explicit_exit" | "runtime_terminated" {
    return reason === "prompt_input_exit" ? "explicit_exit" : "runtime_terminated";
}

function buildSessionEndedTitle(reason: string): string {
    switch (reason) {
        case "prompt_input_exit": return "Session ended (user exit)";
        case "logout": return "Session ended (logout)";
        case "resume": return "Session ended (superseded by resume)";
        default: return `Session ended (${reason})`;
    }
}

await runHook("SessionEnd", {
    logger: claudeHookRuntime.logger,
    parse: readSessionEnd,
    handler: async (payload) => {
        const reason = payload.reason ?? "other";
        if (reason === "clear") return;

        const ids = await ensureRuntimeSession(payload.sessionId, undefined, {resume: false});
        await postJson("/api/runtime-session-end", {
            runtimeSource: CLAUDE_RUNTIME_SOURCE,
            runtimeSessionId: payload.sessionId,
            summary: `Claude Code session ended (${reason})`,
            completionReason: mapCompletionReason(reason),
            ...(reason === "prompt_input_exit" ? {completeTask: true} : {}),
        });

        const metadata: SessionEndedMetadata = {
            ...provenEvidence("Emitted by the SessionEnd hook."),
            reason,
            completionReason: mapCompletionReason(reason),
            source: "session-end",
            sessionEndedAt: new Date().toISOString(),
            ...(payload.transcriptPath ? {transcriptPath: payload.transcriptPath} : {}),
            ...(payload.permissionMode ? {permissionMode: payload.permissionMode} : {}),
            ...(payload.cwd ? {cwd: payload.cwd} : {}),
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.sessionEnded,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title: buildSessionEndedTitle(reason),
            body: `Claude Code session ended (${reason}).`,
            lane: LANE.user,
            metadata,
        });

        deleteTodoState(payload.sessionId);
    },
});

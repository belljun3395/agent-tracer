/** Claude Code 세션이 끝나면 실행되는 훅으로 종료 사유와 함께 세션 종료를 남긴다. */
import {SESSION_END_REASON, readSessionEnd} from "~runtime/agent/claude-code/payload/session.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onSessionEnd} from "~runtime/domain/session/inbound/session.hook.js";

await runHook("SessionEnd", {
    parse: readSessionEnd,
    handler: async (payload) => {
        const reason = payload.reason ?? "other";
        // clear로 끝난 세션에는 곧바로 SessionStart(clear)가 뒤따른다.
        if (reason === SESSION_END_REASON.clear) return;

        const target = await ensureClaudeSession(payload.sessionId, undefined, {
            resume: false,
            transcriptPath: payload.transcriptPath,
        });
        await onSessionEnd(claudeRuntime.session, {
            taskId: target.taskId,
            sessionId: target.sessionId,
            ...(target.turnId !== undefined ? {turnId: target.turnId} : {}),
            runtimeSource: claudeRuntime.runtimeSource,
            runtimeSessionId: payload.sessionId,
            summary: `Claude Code session ended (${reason})`,
            completionReason: reason === SESSION_END_REASON.promptInputExit
                ? "explicit_exit"
                : "runtime_terminated",
            completeTask: reason === SESSION_END_REASON.promptInputExit,
        });

        claudeRuntime.todoSnapshots.clear(payload.sessionId);
    },
});

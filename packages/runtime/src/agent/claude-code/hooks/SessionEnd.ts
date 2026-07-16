/** Claude Code 세션이 끝나면 실행되는 훅으로 종료 사유와 함께 세션 종료를 남긴다. */
import {readSessionEnd} from "~runtime/agent/claude-code/payload/session.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onSessionEnd} from "~runtime/domain/session/inbound/session.hook.js";

await runHook("SessionEnd", {
    parse: readSessionEnd,
    handler: async (payload) => {
        const reason = payload.reason ?? "other";
        // clear로 끝난 세션에는 곧바로 SessionStart(clear)가 뒤따른다.
        if (reason === "clear") return;

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
            completionReason: reason === "prompt_input_exit" ? "explicit_exit" : "runtime_terminated",
            completeTask: reason === "prompt_input_exit",
        });

        claudeRuntime.todoSnapshots.clear(payload.sessionId);
    },
});

/** Claude Code 세션이 끝나면 실행되는 훅으로 종료 사유와 함께 세션 종료를 남긴다. */
import {SESSION_END_REASON, readSessionEnd} from "~runtime/agent/claude-code/payload/session.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onBindingRelease} from "~runtime/domain/binding/inbound/binding.hook.js";
import {onSessionEnd} from "~runtime/domain/session/inbound/session.hook.js";

await runHook("SessionEnd", {
    parse: readSessionEnd,
    handler: async (payload) => {
        const reason = payload.reason ?? "other";
        // /clear는 옛 session_id로 여기 오므로 태스크 경계의 '닫기'를 이 훅이 맡는다.
        const cleared = reason === SESSION_END_REASON.clear;
        const exited = reason === SESSION_END_REASON.promptInputExit;

        const target = await ensureClaudeSession(payload.sessionId, undefined, {
            resume: false,
            transcriptPath: payload.transcriptPath,
        });
        let completionReason: "cleared" | "explicit_exit" | "runtime_terminated" = "runtime_terminated";
        if (cleared) completionReason = "cleared";
        else if (exited) completionReason = "explicit_exit";
        await onSessionEnd(claudeRuntime.session, {
            taskId: target.taskId,
            sessionId: target.sessionId,
            ...(target.turnId !== undefined ? {turnId: target.turnId} : {}),
            runtimeSource: claudeRuntime.runtimeSource,
            runtimeSessionId: payload.sessionId,
            summary: cleared
                ? "Claude Code conversation cleared (/clear)"
                : `Claude Code session ended (${reason})`,
            completionReason,
            completeTask: cleared || exited,
        });

        claudeRuntime.todoSnapshots.clear(payload.sessionId);

        // /clear는 후임이 승계를 새기므로 바인딩을 남기고, 그 밖의 종료는 식별자가 다시 풀리지 않게 지운다.
        if (!cleared) await onBindingRelease(claudeRuntime.binding, claudeRuntime.runtimeSource, payload.sessionId);
    },
});

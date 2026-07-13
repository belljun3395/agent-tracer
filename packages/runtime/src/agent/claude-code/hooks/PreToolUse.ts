/** 모든 도구 호출 전에 Claude Code가 실행하는 훅으로 금지 조항에 걸리는 호출만 사전 거부하고 힌트를 낸다. */
import {emitHints, emitPreToolDenial} from "~runtime/agent/claude-code/hook.output.js";
import {readPreToolUse} from "~runtime/agent/claude-code/payload/tool.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {captureTranscriptCommentary} from "~runtime/agent/claude-code/transcript/transcript.commentary.js";
import {queryDaemonHints, queryDaemonPreToolGuard} from "~runtime/daemon/ipc/hook.client.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {
    POWERSHELL_TOOL_NAME,
    TERMINAL_COMMAND_TOOL_NAME,
} from "~runtime/domain/ingest/model/event.model.js";
import {toTrimmedString} from "~runtime/support/text.js";

const SHELL_TOOLS: ReadonlySet<string> = new Set([TERMINAL_COMMAND_TOOL_NAME, POWERSHELL_TOOL_NAME]);

await runHook("PreToolUse", {
    parse: readPreToolUse,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await captureTranscriptCommentary(payload, target, (events) =>
            onLifecycleEvent(claudeRuntime.ingest, events));

        const toolName = payload.toolName;
        if (!toolName) return;

        const command = SHELL_TOOLS.has(toolName)
            ? toTrimmedString(payload.toolInput["command"]) || undefined
            : undefined;
        const filePath = toTrimmedString(payload.toolInput["file_path"]) || undefined;
        const questions = toolName === "AskUserQuestion" ? readQuestions(payload.toolInput) : [];

        if ((command !== undefined || filePath !== undefined) && guardrailEnabled()) {
            const denial = await queryDaemonPreToolGuard(
                target.taskId,
                target.sessionId,
                toolName,
                command,
                filePath,
            );
            if (denial !== null) {
                emitPreToolDenial(denial);
                return;
            }
        }

        if (command === undefined && questions.length === 0) return;

        const hints = await queryDaemonHints(target.taskId, {
            trigger: "pre_tool",
            toolName,
            ...(command !== undefined ? {command} : {}),
            ...(questions.length > 0 ? {questions} : {}),
        });
        emitHints("PreToolUse", hints);
    },
});

function guardrailEnabled(): boolean {
    return process.env.AGENT_TRACER_GUARDRAIL_BLOCK !== "0";
}

function readQuestions(toolInput: Record<string, unknown>): readonly string[] {
    const questions = toolInput["questions"];
    if (!Array.isArray(questions)) return [];
    return questions.flatMap((item) => {
        if (typeof item !== "object" || item === null) return [];
        const text = toTrimmedString((item as Record<string, unknown>)["question"]);
        return text ? [text] : [];
    });
}

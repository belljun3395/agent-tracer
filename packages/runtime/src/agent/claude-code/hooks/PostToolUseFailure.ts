/** 도구 호출이 실패하면 Claude Code가 실행하는 훅이다. */
import {readPostToolUseFailure} from "~runtime/agent/claude-code/payload/tool.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onToolFailure} from "~runtime/domain/ingest/inbound/tool.hook.js";
import type {ToolFailure} from "~runtime/domain/ingest/model/tool.call.model.js";

await runHook("PostToolUseFailure", {
    parse: readPostToolUseFailure,
    handler: async (payload) => {
        if (!payload.toolName) return;
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType, payload.transcriptPath);
        const failure: ToolFailure = {
            toolName: payload.toolName,
            toolInput: payload.toolInput,
            toolResponse: payload.payload["tool_response"],
            ...(payload.toolUseId !== undefined ? {toolUseId: payload.toolUseId} : {}),
            error: payload.error,
            isInterrupt: payload.isInterrupt,
        };
        await onToolFailure(claudeRuntime.ingest, failure, target);
    },
});

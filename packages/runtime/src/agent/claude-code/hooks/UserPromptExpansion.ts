/** 슬래시 커맨드나 MCP 프롬프트가 완전한 프롬프트로 펼쳐지면 Claude Code가 실행하는 훅이다. */
import {readUserPromptExpansion} from "~runtime/agent/claude-code/payload/workspace.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {promptExpansionEvent} from "~runtime/domain/ingest/model/message.event.model.js";

await runHook("UserPromptExpansion", {
    parse: readUserPromptExpansion,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await onLifecycleEvent(claudeRuntime.ingest, [
            promptExpansionEvent(target, {
                expansionType: payload.expansionType,
                commandName: payload.commandName,
                ...(payload.commandArgs !== undefined ? {commandArgs: payload.commandArgs} : {}),
                ...(payload.commandSource !== undefined ? {commandSource: payload.commandSource} : {}),
                ...(payload.prompt !== undefined ? {expandedPrompt: payload.prompt} : {}),
            }),
        ]);
    },
});

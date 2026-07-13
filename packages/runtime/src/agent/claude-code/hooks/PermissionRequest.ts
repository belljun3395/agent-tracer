/** 권한 다이얼로그가 뜨기 직전 Claude Code가 실행하는 훅이며 아무 JSON도 내지 않아 사용자의 선택을 뒤집지 않는다. */
import {readPermissionRequest} from "~runtime/agent/claude-code/payload/tool.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {permissionRequestEvent} from "~runtime/domain/ingest/model/workspace.event.model.js";

await runHook("PermissionRequest", {
    parse: readPermissionRequest,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await onLifecycleEvent(claudeRuntime.ingest, [
            permissionRequestEvent(target, {
                toolName: payload.toolName,
                toolInput: payload.toolInput,
                ...(payload.toolUseId !== undefined ? {toolUseId: payload.toolUseId} : {}),
                suggestionCount: payload.suggestionCount,
            }),
        ]);
    },
});

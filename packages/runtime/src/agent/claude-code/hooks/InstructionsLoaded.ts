/** 지침 파일이 컨텍스트에 로드되면 Claude Code가 실행하는 훅이다. */
import {readInstructionsLoaded} from "~runtime/agent/claude-code/payload/workspace.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {instructionsLoadedEvent} from "~runtime/domain/ingest/model/workspace.event.model.js";

await runHook("InstructionsLoaded", {
    parse: readInstructionsLoaded,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await onLifecycleEvent(claudeRuntime.ingest, [
            instructionsLoadedEvent(target, {
                projectDir: claudeRuntime.projectDir,
                filePath: payload.filePath,
                loadReason: payload.loadReason ?? "session_start",
                memoryType: payload.memoryType ?? "Project",
            }),
        ]);
    },
});

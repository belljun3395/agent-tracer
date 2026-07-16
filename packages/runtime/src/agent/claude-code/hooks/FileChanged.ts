/** 감시 대상 파일이 디스크에서 바뀌면 Claude Code가 실행하는 훅이며 matcher에는 정규식이 아니라 파이프로 구분한 파일명을 쓴다. */
import {readFileChanged} from "~runtime/agent/claude-code/payload/workspace.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {fileChangedEvent} from "~runtime/domain/ingest/model/workspace.event.model.js";

await runHook("FileChanged", {
    parse: readFileChanged,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType, payload.transcriptPath);
        await onLifecycleEvent(claudeRuntime.ingest, [
            fileChangedEvent(target, claudeRuntime.projectDir, payload.filePath),
        ]);
    },
});

/** worktree가 제거되는 중에 Claude Code가 실행하는 훅이며 출력과 종료 코드가 무시되는 순수 관찰용이다. */
import {readWorktree} from "~runtime/agent/claude-code/payload/workspace.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {worktreeRemovedEvent} from "~runtime/domain/ingest/model/workspace.event.model.js";

await runHook("WorktreeRemove", {
    parse: readWorktree,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType, payload.transcriptPath);
        await onLifecycleEvent(claudeRuntime.ingest, [
            worktreeRemovedEvent(target, claudeRuntime.projectDir, payload.worktreePath),
        ]);
    },
});

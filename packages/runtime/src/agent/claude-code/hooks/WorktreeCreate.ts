/** worktree가 생성되는 중에 Claude Code가 실행하는 훅이며 0이 아닌 종료 코드가 생성을 중단시키므로 관찰만 한다. */
import {readWorktree} from "~runtime/agent/claude-code/payload/workspace.payload.js";
import {claudeRuntime, resolveEventSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {worktreeEvent} from "~runtime/domain/ingest/model/workspace.event.model.js";

await runHook("WorktreeCreate", {
    parse: readWorktree,
    handler: async (payload) => {
        const target = await resolveEventSession(payload.sessionId, payload.agentId, payload.agentType);
        await onLifecycleEvent(claudeRuntime.ingest, [
            worktreeEvent(target, claudeRuntime.projectDir, payload.worktreePath, "create"),
        ]);
    },
});

/** Claude Code가 사용자 알림을 보내면 실행되는 훅이며 idle_prompt는 사용자 입력을 기다리는 동안에도 온다. */
import {readNotification} from "~runtime/agent/claude-code/payload/workspace.payload.js";
import {
    claudeRuntime,
    ensureClaudeSession,
    ensureSubagentSession,
    runHook,
} from "~runtime/agent/claude-code/runtime.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {notificationEvent} from "~runtime/domain/ingest/model/lifecycle.event.model.js";

await runHook("Notification", {
    parse: readNotification,
    handler: async (payload) => {
        const target = payload.agentId !== undefined
            ? await ensureSubagentSession(payload.sessionId, payload.agentId, payload.agentType)
            : await ensureClaudeSession(payload.sessionId, undefined, {resume: false});
        await onLifecycleEvent(claudeRuntime.ingest, [
            notificationEvent(
                target,
                payload.notificationType ?? "unknown",
                payload.notificationMessage,
            ),
        ]);
    },
});

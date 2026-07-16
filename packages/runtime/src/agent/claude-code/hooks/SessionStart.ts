/** Claude Code 세션이 시작되거나 재개되면 실행되는 훅으로 런타임 세션을 확보하고 레시피 캐시를 갱신한다. */
import {emitDeliveryWarning} from "~runtime/agent/claude-code/hook.output.js";
import {readSessionStart, SESSION_START_SOURCE} from "~runtime/agent/claude-code/payload/session.payload.js";
import {claudeRuntime, clearClaudeSession, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {queryDaemonDelivery} from "~runtime/daemon/ipc/hook.client.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {sessionTriggerEvent} from "~runtime/domain/ingest/model/lifecycle.event.model.js";
import {onRecipeCacheRefresh} from "~runtime/domain/recipe/inbound/recipe.hook.js";

await runHook("SessionStart", {
    parse: readSessionStart,
    handler: async (payload) => {
        const source = payload.source.toLowerCase();
        const target = source === SESSION_START_SOURCE.clear
            ? await clearClaudeSession(payload.sessionId)
            : await ensureClaudeSession(payload.sessionId, undefined, {transcriptPath: payload.transcriptPath});
        const event = sessionTriggerEvent(target, source);
        if (event !== null) await onLifecycleEvent(claudeRuntime.ingest, [event]);
        await onRecipeCacheRefresh(claudeRuntime.recipe);
        emitDeliveryWarning(await queryDaemonDelivery());
    },
});

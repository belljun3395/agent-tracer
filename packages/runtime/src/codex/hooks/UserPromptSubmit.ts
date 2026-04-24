/**
 * Codex Hook: UserPromptSubmit
 *
 * Ref: https://developers.openai.com/codex/hooks#userpromptsubmit
 *
 * Stdin payload fields:
 *   session_id       string
 *   cwd              string
 *   hook_event_name  string — "UserPromptSubmit"
 *   model            string
 *   turn_id          string
 *   prompt           string
 *
 * Blocking: Yes (decision: "block"). This handler never blocks.
 *
 * Ensures the runtime session exists (creating a new task on first message)
 * and records the user message.
 */
import {createMessageId, ellipsize} from "~codex/util/utils.js";
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {readCodexUserPromptSubmit} from "~shared/hooks/codex/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type UserMessageMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {writeLatestSessionState} from "~codex/util/session.state.js";
import {ensureObserverRunning} from "~codex/util/observer.js";

await runHook("UserPromptSubmit", {
    logger: codexHookRuntime.logger,
    parse: readCodexUserPromptSubmit,
    handler: async (payload) => {
        if (!payload.sessionId || !payload.prompt) return;

        const ids = await ensureRuntimeSession(payload.sessionId, ellipsize(payload.prompt, 120));
        const phase: "initial" | "follow_up" = ids.taskCreated ? "initial" : "follow_up";
        const metadata: UserMessageMetadata = {
            ...provenEvidence("Emitted by the Codex UserPromptSubmit hook."),
            messageId: createMessageId(),
            captureMode: "raw",
            source: "codex-hooks",
            phase,
        };
        await codexHookRuntime.transport.postTaggedEvent({
            kind: KIND.userMessage,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.user,
            title: ellipsize(payload.prompt, 120),
            body: payload.prompt,
            metadata,
        });

        await writeLatestSessionState({
            sessionId: payload.sessionId,
            ...(payload.model ? {modelId: payload.model} : {}),
            source: "user_prompt_submit",
        }).catch(() => undefined);
        await ensureObserverRunning(payload.sessionId, undefined, payload.model).catch(() => undefined);
    },
});

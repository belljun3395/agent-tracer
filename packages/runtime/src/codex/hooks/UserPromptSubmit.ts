/**
 * Codex Hook: UserPromptSubmit
 *
 * Fires when the user submits a prompt, before Codex processes it.
 * No matcher — fires on every user prompt.
 *
 * Stdin payload fields (ref: https://github.com/openai/codex#hooks):
 *   session_id       string  — unique session / thread identifier
 *   hook_event_name  string  — "UserPromptSubmit"
 *   prompt           string  — the raw prompt text submitted by the user
 *   model            string? — current model identifier
 *
 * Stdout: not consumed by Codex for UserPromptSubmit hooks.
 *
 * Blocking: UserPromptSubmit hooks cannot block execution in Codex.
 *
 * This handler ensures the runtime session exists (creating a new task on the
 * first message) and records the user message in the Agent Tracer monitor.
 * The "initial" vs "follow_up" phase is derived from whether ensureRuntimeSession
 * created a new task (ids.taskCreated === true).
 */
import {createMessageId, ellipsize, toTrimmedString} from "~codex/util/utils.js";
import {readHookSessionContext} from "~codex/lib/hook/hook.context.js";
import {ensureRuntimeSession, postTaggedEvent} from "~codex/lib/transport/transport.js";
import {KIND} from "~shared/events/kinds.js";
import {type UserMessageMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {hookLog} from "~codex/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";
import {writeLatestSessionState} from "~codex/util/session.state.js";
import {ensureObserverRunning} from "~codex/util/observer.js";

async function main(): Promise<void> {
    const {payload, sessionId} = await readHookSessionContext("UserPromptSubmit");
    const prompt = toTrimmedString(payload.prompt);
    const modelId = toTrimmedString(payload.model);
    hookLog("UserPromptSubmit", "fired", {sessionId: sessionId || "(none)", promptLen: prompt.length});

    if (!sessionId) {
        hookLog("UserPromptSubmit", "skipped — no sessionId");
        return;
    }
    if (!prompt) {
        hookLog("UserPromptSubmit", "skipped — empty prompt");
        return;
    }

    const ids = await ensureRuntimeSession(sessionId, ellipsize(prompt, 120));
    hookLog("UserPromptSubmit", "ensureRuntimeSession ok", {taskId: ids.taskId});

    const phase: "initial" | "follow_up" = ids.taskCreated ? "initial" : "follow_up";
    const baseMeta: UserMessageMetadata = {
        ...provenEvidence("Emitted by the Codex UserPromptSubmit hook."),
        messageId: createMessageId(),
        captureMode: "raw",
        source: "codex-hooks",
        phase,
    };
    await postTaggedEvent({
        kind: KIND.userMessage,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.user,
        title: ellipsize(prompt, 120),
        body: prompt,
        metadata: baseMeta,
    });
    hookLog("UserPromptSubmit", "user-message posted", {phase});

    await writeLatestSessionState({
        sessionId,
        ...(modelId ? {modelId} : {}),
        source: "user_prompt_submit",
    }).catch(() => undefined);
    await ensureObserverRunning(sessionId, undefined, modelId || undefined).catch(() => undefined);
}

void main().catch((err: unknown) => {
    hookLog("UserPromptSubmit", "ERROR", {error: String(err)});
});

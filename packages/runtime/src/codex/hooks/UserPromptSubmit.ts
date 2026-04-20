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
import { ensureRuntimeSession, postTaggedEvent, readStdinJson } from "~codex/lib/transport/transport.js";
import { createMessageId, ellipsize, toTrimmedString } from "~codex/util/utils.js";
import { KIND } from "~shared/events/kinds.js";
import { LANE } from "~shared/events/lanes.js";
import { provenEvidence } from "~shared/semantics/evidence.js";
import { writeLatestSessionState } from "~codex/util/session.state.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    const prompt = toTrimmedString(payload.prompt);
    const modelId = toTrimmedString(payload.model);
    if (!sessionId || !prompt) return;

    const ids = await ensureRuntimeSession(sessionId);
    await postTaggedEvent({
        kind: KIND.userMessage,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: ellipsize(prompt, 120),
        body: prompt,
        lane: LANE.user,
        metadata: {
            ...provenEvidence("Emitted by the Codex UserPromptSubmit hook."),
            messageId: createMessageId("user"),
            captureMode: "raw",
            source: "codex-hooks",
            phase: ids.taskCreated ? "initial" : "follow_up",
        },
    });

    await writeLatestSessionState({
        sessionId,
        ...(modelId ? { modelId } : {}),
        source: "user_prompt_submit",
    }).catch(() => undefined);
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

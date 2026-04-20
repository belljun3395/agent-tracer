import { ensureRuntimeSession, postTaggedEvent, readStdinJson } from "~codex/lib/transport/transport.js";
import { createMessageId, ellipsize, toTrimmedString } from "~codex/util/utils.js";
import { KIND } from "~shared/events/kinds.js";
import { LANE } from "~shared/events/lanes.js";
import { provenEvidence } from "~shared/semantics/evidence.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    const prompt = toTrimmedString(payload.prompt);
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
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

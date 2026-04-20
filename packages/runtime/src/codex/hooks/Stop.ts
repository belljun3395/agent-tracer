import { ensureRuntimeSession, postTaggedEvent, readStdinJson } from "~codex/lib/transport/transport.js";
import { createMessageId, ellipsize, toTrimmedString } from "~codex/util/utils.js";
import { KIND } from "~shared/events/kinds.js";
import { LANE } from "~shared/events/lanes.js";
import { provenEvidence } from "~shared/semantics/evidence.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    const responseText = toTrimmedString(payload.last_assistant_message);
    if (!sessionId || !responseText) return;

    const ids = await ensureRuntimeSession(sessionId);
    await postTaggedEvent({
        kind: KIND.assistantResponse,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: ellipsize(responseText, 120),
        body: responseText,
        lane: LANE.user,
        metadata: {
            ...provenEvidence("Emitted by the Codex Stop hook."),
            messageId: createMessageId("assistant"),
            source: "codex-hooks",
            stopReason: "stop_hook",
        },
    });
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

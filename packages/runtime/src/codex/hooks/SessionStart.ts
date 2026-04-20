import { ensureRuntimeSession, postTaggedEvent, readStdinJson } from "~codex/lib/transport/transport.js";
import { KIND } from "~shared/events/kinds.js";
import { LANE } from "~shared/events/lanes.js";
import { provenEvidence } from "~shared/semantics/evidence.js";
import { toTrimmedString } from "~codex/util/utils.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    const source = toTrimmedString(payload.source).toLowerCase();
    if (!sessionId || (source !== "startup" && source !== "resume")) return;

    const ids = await ensureRuntimeSession(sessionId);
    const title = source === "resume" ? "Session resumed" : "Session started";
    const body = source === "resume" ? "Codex CLI session resumed." : "Codex CLI session started.";

    await postTaggedEvent({
        kind: KIND.contextSaved,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title,
        body,
        lane: LANE.planning,
        metadata: {
            ...provenEvidence("Emitted by the Codex SessionStart hook."),
            trigger: source,
        },
    });
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

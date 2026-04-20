import { ensureRuntimeSession, postTaggedEvent, readStdinJson } from "~codex/lib/transport/transport.js";
import { toTrimmedString } from "~codex/util/utils.js";
import { KIND } from "~shared/events/kinds.js";
import { provenEvidence } from "~shared/semantics/evidence.js";
import { buildSemanticMetadata, inferCommandSemantic } from "~shared/semantics/inference.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    const command = toTrimmedString(
        payload.tool_input && typeof payload.tool_input === "object" && "command" in payload.tool_input
            ? (payload.tool_input as { command?: unknown }).command
            : undefined,
    );
    if (!sessionId || !command) return;

    const ids = await ensureRuntimeSession(sessionId);
    const semantic = inferCommandSemantic(command);
    await postTaggedEvent({
        kind: KIND.terminalCommand,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: command.slice(0, 80),
        body: command,
        lane: semantic.lane,
        metadata: {
            ...provenEvidence("Observed directly by the Codex PostToolUse hook."),
            ...buildSemanticMetadata(semantic.metadata),
            command,
        },
    });
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

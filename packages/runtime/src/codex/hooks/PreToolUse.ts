import { ensureRuntimeSession, readStdinJson } from "~codex/lib/transport/transport.js";
import { toTrimmedString } from "~codex/util/utils.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    if (!sessionId) return;
    await ensureRuntimeSession(sessionId);
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

/**
 * PreToolUse hook — ensures a runtime session/task exists before tool execution.
 *
 * Codex fires this before every Bash invocation (currently only Bash is supported).
 * Payload includes: session_id, tool_input.command, tool_use_id, cwd, model, turn_id
 */
import {
    ensureRuntimeSession,
    getSessionId,
    hookLog,
    hookLogPayload,
    readStdinJson,
    setProjectDir,
    toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("pre_tool", payload);

    const cwd = toTrimmedString(payload.cwd);
    if (cwd) setProjectDir(cwd);

    const sessionId = getSessionId(payload);
    if (!sessionId) {
        hookLog("pre_tool", "skipped — no sessionId");
        return;
    }

    await ensureRuntimeSession(sessionId);
    hookLog("pre_tool", "ensureRuntimeSession ok", { sessionId });
}

void main().catch((err: unknown) => {
    hookLog("pre_tool", "ERROR", { error: String(err) });
});

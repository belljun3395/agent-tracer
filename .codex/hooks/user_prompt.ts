import {
    createMessageId,
    defaultTaskTitle,
    ellipsize,
    ensureRuntimeSession,
    getSessionId,
    hookLog,
    hookLogPayload,
    postJson,
    readStdinJson,
    setProjectDir,
    toTrimmedString
} from "./common.js";
import { queuePendingUserPrompt, readHookState, writeHookState } from "./hook_state.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("user_prompt", payload);

    const cwd = toTrimmedString(payload.cwd);
    if (cwd) setProjectDir(cwd);

    const prompt = toTrimmedString(payload.prompt);
    const sessionId = getSessionId(payload);

    hookLog("user_prompt", "fired", { sessionId: sessionId || "(none)", promptLen: prompt.length });

    if (!sessionId) {
        hookLog("user_prompt", "skipped — no sessionId");
        return;
    }

    const title = prompt ? ellipsize(prompt, 120) : defaultTaskTitle();
    const ids = await ensureRuntimeSession(sessionId, title);
    hookLog("user_prompt", "ensureRuntimeSession ok", { taskId: ids.taskId });

    if (!prompt) return;

    await postJson("/api/user-message", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        messageId: createMessageId(),
        captureMode: "raw",
        source: "codex-hook",
        title,
        body: prompt
    });
    writeHookState(queuePendingUserPrompt(readHookState(), sessionId, prompt));
    hookLog("user_prompt", "user-message posted", { title });
}

void main().catch((err: unknown) => {
    hookLog("user_prompt", "ERROR", { error: String(err) });
});

import { createMessageId, defaultTaskTitle, ellipsize, ensureRuntimeSession, getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, toTrimmedString } from "./common.js";
async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("user_prompt", payload);
    const prompt = toTrimmedString(payload.prompt);
    const sessionId = getSessionId(payload);
    hookLog("user_prompt", "fired", { sessionId: sessionId || "(none)", promptLen: prompt.length });
    if (!sessionId) {
        hookLog("user_prompt", "skipped — no sessionId");
        return;
    }
    if (prompt.toLowerCase() === "/exit" || prompt.toLowerCase() === "exit") {
        hookLog("user_prompt", "skipped — exit command");
        return;
    }
    const title = prompt ? ellipsize(prompt, 120) : defaultTaskTitle();
    const ids = await ensureRuntimeSession(sessionId, title);
    hookLog("user_prompt", "ensureRuntimeSession ok", { taskId: ids.taskId });
    if (!prompt)
        return;
    await postJson("/api/user-message", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        messageId: createMessageId(),
        captureMode: "raw",
        source: "claude-plugin",
        title,
        body: prompt
    });
    hookLog("user_prompt", "user-message posted", { title });
}
void main().catch((err: unknown) => {
    hookLog("user_prompt", "ERROR", { error: String(err) });
});

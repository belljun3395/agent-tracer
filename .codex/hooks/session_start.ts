import {
    ensureRuntimeSession,
    getSessionId,
    hookLog,
    hookLogPayload,
    postJson,
    readStdinJson,
    setProjectDir,
    toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("session_start", payload);

    // Codex passes the working directory in `cwd`
    const cwd = toTrimmedString(payload.cwd);
    if (cwd) setProjectDir(cwd);

    const sessionId = getSessionId(payload);
    // Codex SessionStart uses `source` field: "startup" | "resume"
    const source = toTrimmedString(payload.source).toLowerCase();

    hookLog("session_start", "fired", { sessionId: sessionId || "(none)", source });

    if (!sessionId || (source !== "startup" && source !== "resume")) {
        hookLog("session_start", "skipped — no sessionId or unknown source");
        return;
    }

    const TITLES: Record<string, string> = {
        startup: "Session started",
        resume: "Session resumed"
    };
    const BODIES: Record<string, string> = {
        startup: "Codex session started.",
        resume: "Codex session resumed."
    };

    const ids = await ensureRuntimeSession(sessionId);
    hookLog("session_start", "ensureRuntimeSession ok", { taskId: ids.taskId });

    await postJson("/api/save-context", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: TITLES[source],
        body: BODIES[source],
        lane: "planning",
        metadata: { trigger: source }
    });
    hookLog("session_start", "save-context posted", { title: TITLES[source] });
}

void main().catch((err: unknown) => {
    hookLog("session_start", "ERROR", { error: String(err) });
});

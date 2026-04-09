import { ensureRuntimeSession, getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, toTrimmedString } from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("session_start", payload);
  const sessionId = getSessionId(payload);
  const source = toTrimmedString(payload.source).toLowerCase();

  hookLog("session_start", "fired", { sessionId: sessionId || "(none)", source });

  const TITLES: Record<string, string> = {
    startup: "Session started",
    resume: "Session resumed",
    clear: "Conversation cleared",
    compact: "Session resumed after compact"
  };
  const BODIES: Record<string, string> = {
    startup: "Claude Code session started.",
    resume: "Claude Code session resumed.",
    clear: "Claude Code conversation was cleared (/clear).",
    compact: "Claude Code session resumed after context compaction."
  };

  if (!sessionId || !(source in TITLES)) {
    hookLog("session_start", "skipped — no sessionId or unknown source");
    return;
  }

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

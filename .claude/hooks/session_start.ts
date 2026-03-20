import { ensureRuntimeSession, getSessionId, postJson, readStdinJson, toTrimmedString } from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  const sessionId = getSessionId(payload);
  const source = toTrimmedString(payload.source).toLowerCase();

  const TITLES: Record<string, string> = {
    startup: "Session started",
    resume: "Session resumed",
    clear: "Conversation cleared"
  };
  const BODIES: Record<string, string> = {
    startup: "Claude Code session started.",
    resume: "Claude Code session resumed.",
    clear: "Claude Code conversation was cleared (/clear)."
  };

  if (!sessionId || !(source in TITLES)) return;

  const ids = await ensureRuntimeSession(sessionId);
  await postJson("/api/save-context", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    title: TITLES[source],
    body: BODIES[source],
    lane: "planning",
    metadata: { trigger: source }
  });
}

void main().catch(() => {});

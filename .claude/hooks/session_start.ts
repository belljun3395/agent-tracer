import { CLAUDE_RUNTIME, ensureRuntimeSession, getSessionId, postJson, readStdinJson, toTrimmedString } from "./common.js";

async function main(): Promise<void> {
  if (!CLAUDE_RUNTIME) return;

  const payload = await readStdinJson();
  const sessionId = getSessionId(payload);
  const source = toTrimmedString(payload.source).toLowerCase();

  if (!sessionId || source !== "clear") return;

  const ids = await ensureRuntimeSession(sessionId);
  await postJson("/api/save-context", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    title: "Conversation cleared",
    body: "Claude Code conversation was cleared (/clear).",
    lane: "planning",
    metadata: { trigger: "clear" }
  });
}

void main().catch(() => {});

import {
  createMessageId,
  defaultTaskTitle,
  ellipsize,
  ensureRuntimeSession,
  getSessionId,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  const prompt = toTrimmedString(payload.prompt);
  const sessionId = getSessionId(payload);
  if (!sessionId) return;

  if (prompt.toLowerCase() === "/exit" || prompt.toLowerCase() === "exit") {
    return;
  }

  const title = prompt ? ellipsize(prompt, 120) : defaultTaskTitle();
  const ids = await ensureRuntimeSession(sessionId, title);

  if (!prompt) return;

  await postJson("/api/user-message", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    messageId: createMessageId(),
    captureMode: "raw",
    source: "claude-hook",
    title,
    body: prompt
  });
}

void main().catch(() => {});

import {
  ensureRuntimeSession,
  getSessionId,
  getToolInput,
  hookLog,
  hookLogPayload,
  inferCommandLane,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("terminal", payload);
  const toolInput = getToolInput(payload);
  const sessionId = getSessionId(payload);
  const command = toTrimmedString(toolInput.command);
  const description = toTrimmedString(toolInput.description);

  hookLog("terminal", "fired", { sessionId: sessionId || "(none)", cmdPreview: command.slice(0, 60) });

  if (!sessionId || !command) {
    hookLog("terminal", "skipped — no sessionId or command");
    return;
  }

  const ids = await ensureRuntimeSession(sessionId);
  const lane = inferCommandLane(command);

  await postJson("/api/terminal-command", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    command,
    title: description || command.slice(0, 80),
    body: description ? `${description}\n\n$ ${command}` : command,
    lane,
    metadata: {
      description
    }
  });

  hookLog("terminal", "terminal-command posted", { description: description || command.slice(0, 60) });

  if (!description) return;

  await postJson("/api/save-context", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    title: description,
    body: `Intent: ${description}\nAction: $ ${command}`,
    lane: "planning",
    metadata: {
      command
    }
  });
}

void main().catch((err: unknown) => {
  hookLog("terminal", "ERROR", { error: String(err) });
});

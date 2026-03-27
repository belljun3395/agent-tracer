import {
  buildSemanticMetadata,
  ensureRuntimeSession,
  getSessionId,
  getToolInput,
  hookLog,
  hookLogPayload,
  inferCommandSemantic,
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
  const semantic = inferCommandSemantic(command);

  await postJson("/api/terminal-command", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    command,
    title: description || command.slice(0, 80),
    body: description ? `${description}\n\n$ ${command}` : command,
    lane: semantic.lane,
    metadata: {
      description,
      command,
      ...buildSemanticMetadata(semantic.metadata)
    }
  });

  hookLog("terminal", "terminal-command posted", { description: description || command.slice(0, 60) });
}

void main().catch((err: unknown) => {
  hookLog("terminal", "ERROR", { error: String(err) });
});

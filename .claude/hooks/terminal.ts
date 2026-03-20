import {
  ensureRuntimeSession,
  getSessionId,
  getToolInput,
  inferCommandLane,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

const MAX_COMMAND_LENGTH = 500;

async function main(): Promise<void> {
  const payload = await readStdinJson();
  const toolInput = getToolInput(payload);
  const sessionId = getSessionId(payload);
  const command = toTrimmedString(toolInput.command);
  const description = toTrimmedString(toolInput.description);

  if (!sessionId || !command) return;

  const ids = await ensureRuntimeSession(sessionId);
  const lane = inferCommandLane(command);

  await postJson("/api/terminal-command", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    command: command.slice(0, MAX_COMMAND_LENGTH),
    title: description || command.slice(0, 80),
    body: description ? `${description}\n\n$ ${command.slice(0, 300)}` : command,
    lane,
    metadata: {
      description
    }
  });

  if (!description) return;

  await postJson("/api/save-context", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    title: description,
    body: `Intent: ${description}\nAction: $ ${command.slice(0, 200)}`,
    lane: "planning",
    metadata: {
      command: command.slice(0, 200)
    }
  });
}

void main().catch(() => {});

import {
  CLAUDE_RUNTIME,
  defaultTaskTitle,
  ensureRuntimeSession,
  getSessionId,
  getToolInput,
  postJson,
  readStdinJson,
  stringifyToolInput,
  toBoolean,
  toTrimmedString
} from "./common.js";

function extractChildSessionId(toolResponse: unknown): string {
  const text = typeof toolResponse === "string"
    ? toolResponse
    : JSON.stringify(toolResponse ?? {});
  const match = /session_id[:\s]+([a-f0-9-]{8,})/i.exec(text);
  return match?.[1]?.trim() ?? "";
}

async function main(): Promise<void> {
  if (!CLAUDE_RUNTIME) return;

  const payload = await readStdinJson();
  const toolName = toTrimmedString(payload.tool_name);
  const toolInput = getToolInput(payload);
  const sessionId = getSessionId(payload);

  if (!sessionId || (toolName !== "Agent" && toolName !== "Skill")) {
    return;
  }

  const ids = await ensureRuntimeSession(sessionId);

  const metadata = {
    toolInput: stringifyToolInput(toolInput)
  };

  if (toolName === "Skill") {
    const skillName = toTrimmedString(toolInput.skill);
    await postJson("/api/agent-activity", {
      taskId: ids.taskId,
      sessionId: ids.sessionId,
      activityType: "skill_use",
      title: skillName ? `Skill: ${skillName}` : "Skill invoked",
      ...(toTrimmedString(toolInput.args) ? { body: `args: ${toTrimmedString(toolInput.args, 400)}` } : {}),
      metadata,
      ...(skillName ? { skillName } : {})
    });
    return;
  }

  const description = toTrimmedString(toolInput.description);
  const prompt = toTrimmedString(toolInput.prompt, 400);
  const runInBackground = toBoolean(toolInput.run_in_background);
  const agentName = toTrimmedString(toolInput.subagent_type);
  const title = description ? `Agent: ${description.slice(0, 80)}` : "Agent dispatch";

  await postJson("/api/agent-activity", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    activityType: "delegation",
    title,
    ...(prompt || description ? { body: prompt || description } : {}),
    metadata,
    ...(agentName ? { agentName } : {})
  });

  if (!runInBackground) return;

  const childSessionId = extractChildSessionId(payload.tool_response);
  if (!childSessionId) return;

  const childTitle = description || prompt || defaultTaskTitle();
  const childIds = await ensureRuntimeSession(childSessionId, childTitle);
  await postJson("/api/task-link", {
    taskId: childIds.taskId,
    taskKind: "background",
    parentTaskId: ids.taskId,
    parentSessionId: ids.sessionId,
    title: childTitle
  });
}

void main().catch(() => {});

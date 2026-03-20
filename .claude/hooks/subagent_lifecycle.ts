import {
  ensureRuntimeSession,
  getHookEventName,
  getSessionId,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  const hookEventName = getHookEventName(payload);
  const sessionId = getSessionId(payload);
  const agentId = toTrimmedString(payload.agent_id);
  const agentType = toTrimmedString(payload.agent_type) || "unknown";

  if (!sessionId || !agentId || (hookEventName !== "SubagentStart" && hookEventName !== "SubagentStop")) {
    return;
  }

  const ids = await ensureRuntimeSession(sessionId);

  await postJson("/api/async-task", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    asyncTaskId: agentId,
    asyncStatus: hookEventName === "SubagentStart" ? "running" : "completed",
    title: hookEventName === "SubagentStart"
      ? `Subagent started: ${agentType}`
      : `Subagent finished: ${agentType}`,
    ...(hookEventName === "SubagentStop" && toTrimmedString(payload.last_assistant_message)
      ? { body: toTrimmedString(payload.last_assistant_message, 400) }
      : {}),
    metadata: {
      agentId,
      agentType
    }
  });
}

void main().catch(() => {});

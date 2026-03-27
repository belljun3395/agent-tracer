import {
  ensureRuntimeSession,
  getHookEventName,
  getSessionId,
  hookLog,
  hookLogPayload,
  postJson,
  readStdinJson,
  readSubagentRegistry,
  toTrimmedString,
  writeSubagentRegistry
} from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("subagent_lifecycle", payload);
  const hookEventName = getHookEventName(payload);
  const sessionId = getSessionId(payload);
  const agentId = toTrimmedString(payload.agent_id);
  // agent_type이 "" 인 경우는 /compact 내부 에이전트 — "unknown"으로 덮지 않고 보존
  const agentType = typeof payload.agent_type === "string" ? payload.agent_type : "";

  hookLog("subagent_lifecycle", "fired", { hookEventName, agentId: agentId || "(none)", agentType, sessionId: sessionId || "(none)" });

  if (!sessionId || !agentId || (hookEventName !== "SubagentStart" && hookEventName !== "SubagentStop")) {
    hookLog("subagent_lifecycle", "skipped — missing fields or unexpected event");
    return;
  }

  const ids = await ensureRuntimeSession(sessionId);

  // SubagentStart: agent_id → parentSessionId 매핑을 레지스트리에 저장
  // SubagentStop: 완료된 항목 정리
  const registry = readSubagentRegistry();
  if (hookEventName === "SubagentStart") {
    registry[agentId] = { parentSessionId: sessionId, agentType, linked: false };
    writeSubagentRegistry(registry);
    hookLog("subagent_lifecycle", "registry entry written", { agentId, parentSessionId: sessionId });
  } else if (hookEventName === "SubagentStop") {
    delete registry[agentId];
    writeSubagentRegistry(registry);
    hookLog("subagent_lifecycle", "registry entry removed", { agentId });
  }

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
  hookLog("subagent_lifecycle", "async-task posted", { hookEventName, agentType, agentId });
}

void main().catch((err: unknown) => {
  hookLog("subagent_lifecycle", "ERROR", { error: String(err) });
});

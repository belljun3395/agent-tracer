import {
  ensureRuntimeSession,
  getSessionId,
  hookLog,
  hookLogPayload,
  readStdinJson,
  readSubagentRegistry,
  toTrimmedString,
  writeSubagentRegistry
} from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("ensure_task", payload);
  const sessionId = getSessionId(payload);
  if (!sessionId) return;

  const registry = readSubagentRegistry();

  // PreToolUse 내 agent_id가 있으면 subagent 컨텍스트에서 실행 중인 것.
  // 레지스트리에서 부모 session을 찾아 task-link를 연결 (최초 1회).
  const agentId = toTrimmedString(payload.agent_id);
  if (agentId) {
    const entry = registry[agentId];
    if (entry && !entry.linked) {
      await ensureRuntimeSession(sessionId, undefined, {
        parentTaskId: entry.parentTaskId ?? (await ensureRuntimeSession(entry.parentSessionId)).taskId,
        parentSessionId: entry.parentSessionId
      });
      entry.linked = true;
      writeSubagentRegistry(registry);
      hookLog("ensure_task", "background task created via registry", {
        agentId,
        childSession: sessionId,
        parentSession: entry.parentSessionId,
        parentTaskId: entry.parentTaskId
      });
      return;
    }
  }

  // OpenCode background session: opencode-plugin이 tool.execute.after 시점에
  // "opencode:{sessionId}" 키로 레지스트리에 parentTaskId를 기록해둠.
  // agent_id가 없는 OpenCode sub-agent도 background로 올바르게 연결.
  const opencodeKey = `opencode:${sessionId}`;
  const opencodeEntry = registry[opencodeKey];
  if (opencodeEntry?.parentTaskId && !opencodeEntry.linked) {
    await ensureRuntimeSession(sessionId, undefined, {
      parentTaskId: opencodeEntry.parentTaskId,
      ...(opencodeEntry.parentSessionId ? { parentSessionId: opencodeEntry.parentSessionId } : {})
    });
    opencodeEntry.linked = true;
    writeSubagentRegistry(registry);
    hookLog("ensure_task", "background task linked via opencode registry", {
      sessionId,
      parentTaskId: opencodeEntry.parentTaskId
    });
    return;
  }

  await ensureRuntimeSession(sessionId);
  hookLog("ensure_task", "ensureRuntimeSession ok", { sessionId });
}

void main().catch((err: unknown) => {
  hookLog("ensure_task", "ERROR", { error: String(err) });
});

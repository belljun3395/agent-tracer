import {
  CLAUDE_RUNTIME,
  ensureRuntimeSession,
  getHookEventName,
  getSessionId,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
  if (!CLAUDE_RUNTIME) return;

  const payload = await readStdinJson();
  const hookEventName = getHookEventName(payload);
  const sessionId = getSessionId(payload);
  if (!sessionId || (hookEventName !== "PreCompact" && hookEventName !== "PostCompact")) {
    return;
  }

  const ids = await ensureRuntimeSession(sessionId);
  const trigger = toTrimmedString(payload.trigger) || "auto";

  if (hookEventName === "PreCompact") {
    const customInstructions = toTrimmedString(payload.custom_instructions);
    await postJson("/api/save-context", {
      taskId: ids.taskId,
      sessionId: ids.sessionId,
      title: "Context compacting",
      ...(customInstructions ? { body: customInstructions } : {}),
      lane: "planning",
      metadata: {
        trigger,
        compactPhase: "before"
      }
    });
    return;
  }

  await postJson("/api/save-context", {
    taskId: ids.taskId,
    sessionId: ids.sessionId,
    title: "Context compacted",
    body: toTrimmedString(payload.compact_summary) || "Claude Code compacted the conversation history.",
    lane: "planning",
    metadata: {
      trigger,
      compactPhase: "after"
    }
  });
}

void main().catch(() => {});

import {
  cacheSessionResult,
  createMessageId,
  ellipsize,
  ensureRuntimeSession,
  getCachedSessionResult,
  getSessionId,
  hookLog,
  hookLogPayload,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("stop", payload);
  const sessionId = getSessionId(payload);
  if (!sessionId) {
    hookLog("stop", "skipped — no sessionId");
    return;
  }

  const stopReason = toTrimmedString(payload.stop_reason) || "end_turn";

  // Claude Code Stop hook provides last_assistant_message as a top-level string field
  const responseText = toTrimmedString(payload.last_assistant_message) || "";

  const title = responseText
    ? ellipsize(responseText, 120)
    : `Response (${stopReason})`;

  const ids = getCachedSessionResult(sessionId) ?? await (async () => {
    const fresh = await ensureRuntimeSession(sessionId);
    cacheSessionResult(sessionId, fresh);
    return fresh;
  })();

  const usage = payload.usage as Record<string, unknown> | undefined;

  await postJson("/api/assistant-response", {
    taskId:    ids.taskId,
    sessionId: ids.sessionId,
    messageId: createMessageId(),
    source:    "claude-hook",
    title,
    ...(responseText ? { body: responseText } : {}),
    metadata: {
      stopReason,
      ...(usage?.input_tokens               != null ? { inputTokens:       usage.input_tokens }               : {}),
      ...(usage?.output_tokens              != null ? { outputTokens:      usage.output_tokens }              : {}),
      ...(usage?.cache_read_input_tokens    != null ? { cacheReadTokens:   usage.cache_read_input_tokens }    : {}),
      ...(usage?.cache_creation_input_tokens != null ? { cacheCreateTokens: usage.cache_creation_input_tokens } : {})
    }
  });

  hookLog("stop", "assistant-response posted", { stopReason, hasText: !!responseText });
}

void main().catch((err: unknown) => {
  hookLog("stop", "ERROR", { error: String(err) });
});

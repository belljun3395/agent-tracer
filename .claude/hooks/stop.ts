import {
  createMessageId,
  ellipsize,
  ensureRuntimeSession,
  getSessionId,
  hookLog,
  hookLogPayload,
  postJson,
  readStdinJson,
  toTrimmedString
} from "./common.js";

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((block): block is Record<string, unknown> =>
      typeof block === "object" && block !== null &&
      (block as Record<string, unknown>).type === "text"
    )
    .map(block => String(block.text ?? ""))
    .join("\n")
    .trim();
}

async function main(): Promise<void> {
  const payload = await readStdinJson();
  hookLogPayload("stop", payload);
  const sessionId = getSessionId(payload);
  if (!sessionId) {
    hookLog("stop", "skipped — no sessionId");
    return;
  }

  const stopReason = toTrimmedString(payload.stop_reason) || "end_turn";

  // Extract last assistant message from transcript
  const transcript = Array.isArray(payload.transcript) ? payload.transcript : [];
  const lastAssistant = [...transcript]
    .reverse()
    .find((m): m is Record<string, unknown> =>
      typeof m === "object" && m !== null &&
      (m as Record<string, unknown>).role === "assistant"
    );
  const responseText = lastAssistant ? extractTextFromContent(lastAssistant.content) : "";

  const title = responseText
    ? ellipsize(responseText, 120)
    : `Response (${stopReason})`;

  const ids = await ensureRuntimeSession(sessionId);

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

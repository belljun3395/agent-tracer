import {
  CLAUDE_RUNTIME,
  CLAUDE_RUNTIME_SOURCE,
  getSessionId,
  readStdinJson,
  toTrimmedString,
  postJson
} from "./common.js";

function mapCompletionReason(reason: string): "explicit_exit" | "runtime_terminated" {
  return reason === "prompt_input_exit" ? "explicit_exit" : "runtime_terminated";
}

async function main(): Promise<void> {
  if (!CLAUDE_RUNTIME) return;

  const payload = await readStdinJson();
  const sessionId = getSessionId(payload);
  if (!sessionId) return;

  const reason = toTrimmedString(payload.reason) || "other";

  // /clear fires SessionEnd(reason=clear) then SessionStart(source=clear).
  // session_start.ts records the "Conversation cleared" event — skip here to avoid double-fire.
  if (reason === "clear") return;

  await postJson("/api/runtime-session-end", {
    runtimeSource: CLAUDE_RUNTIME_SOURCE,
    runtimeSessionId: sessionId,
    summary: `Claude Code session ended (${reason})`,
    completionReason: mapCompletionReason(reason)
  });
}

void main().catch(() => {});

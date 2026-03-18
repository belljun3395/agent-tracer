import { CLAUDE_RUNTIME, ensureRuntimeSession, getSessionId, readStdinJson } from "./common.js";

async function main(): Promise<void> {
  if (!CLAUDE_RUNTIME) return;

  const payload = await readStdinJson();
  const sessionId = getSessionId(payload);
  if (!sessionId) return;

  await ensureRuntimeSession(sessionId);
}

void main().catch(() => {});

import { ensureRuntimeSession, getSessionId, readStdinJson } from "./common.js";

async function main(): Promise<void> {
  const payload = await readStdinJson();
  const sessionId = getSessionId(payload);
  if (!sessionId) return;

  await ensureRuntimeSession(sessionId);
}

void main().catch(() => {});

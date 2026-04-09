import { cacheSessionResult, ensureRuntimeSession, getSessionId, hookLog, hookLogPayload, readStdinJson, readSubagentRegistry, toTrimmedString, writeSubagentRegistry } from "./common.js";
async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("ensure_task", payload);
    const sessionId = getSessionId(payload);
    if (!sessionId)
        return;
    const registry = readSubagentRegistry();
    const agentId = toTrimmedString(payload.agent_id);
    if (agentId) {
        const entry = registry[agentId];
        if (entry && !entry.linked) {
            const parentTaskId = entry.parentTaskId ?? (await ensureRuntimeSession(entry.parentSessionId)).taskId;
            const result = await ensureRuntimeSession(sessionId, undefined, {
                parentTaskId,
                parentSessionId: entry.parentSessionId
            });
            cacheSessionResult(sessionId, result);
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
    const result = await ensureRuntimeSession(sessionId);
    cacheSessionResult(sessionId, result);
    hookLog("ensure_task", "ensureRuntimeSession ok", { sessionId });
}
void main().catch((err: unknown) => {
    hookLog("ensure_task", "ERROR", { error: String(err) });
});

import { cacheSessionResult, ensureRuntimeSession, getCachedSessionResult, getHookEventName, getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, toTrimmedString } from "./common.js";
async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("compact", payload);
    const hookEventName = getHookEventName(payload);
    const sessionId = getSessionId(payload);
    hookLog("compact", "fired", { hookEventName, sessionId: sessionId || "(none)" });
    if (!sessionId || (hookEventName !== "PreCompact" && hookEventName !== "PostCompact")) {
        hookLog("compact", "skipped — no sessionId or unexpected event");
        return;
    }
    const ids = getCachedSessionResult(sessionId) ?? await (async () => {
        const fresh = await ensureRuntimeSession(sessionId);
        cacheSessionResult(sessionId, fresh);
        return fresh;
    })();
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
    const summary = toTrimmedString(payload.compact_summary, 1000)
        || "Claude Code compacted the conversation history.";
    await postJson("/api/save-context", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: "Context compacted",
        body: summary,
        lane: "planning",
        metadata: {
            trigger,
            compactPhase: "after"
        }
    });
    hookLog("compact", "save-context posted", { hookEventName, trigger });
}
void main().catch((err: unknown) => {
    hookLog("compact", "ERROR", { error: String(err) });
});

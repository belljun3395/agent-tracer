import { buildSemanticMetadata, cacheSessionResult, defaultTaskTitle, ensureRuntimeSession, getCachedSessionResult, getSessionId, getToolInput, hookLog, hookLogPayload, postJson, readStdinJson, stringifyToolInput, toBoolean, toTrimmedString } from "./common.js";
function extractChildSessionId(toolResponse: unknown): string {
    const text = typeof toolResponse === "string"
        ? toolResponse
        : JSON.stringify(toolResponse ?? {});
    const match = /session_id[:\s]+([a-f0-9-]{8,})/i.exec(text);
    return match?.[1]?.trim() ?? "";
}
async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("agent_activity", payload);
    const toolName = toTrimmedString(payload.tool_name);
    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    hookLog("agent_activity", "fired", { toolName, sessionId: sessionId || "(none)" });
    if (!sessionId || (toolName !== "Agent" && toolName !== "Skill")) {
        hookLog("agent_activity", "skipped — not Agent/Skill or no sessionId");
        return;
    }
    const ids = getCachedSessionResult(sessionId) ?? await (async () => {
        const fresh = await ensureRuntimeSession(sessionId);
        cacheSessionResult(sessionId, fresh);
        return fresh;
    })();
    const metadata = {
        toolInput: stringifyToolInput(toolInput)
    };
    if (toolName === "Skill") {
        const skillName = toTrimmedString(toolInput.skill);
        await postJson("/api/agent-activity", {
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            activityType: "skill_use",
            title: skillName ? `Skill: ${skillName}` : "Skill invoked",
            ...(toTrimmedString(toolInput.args) ? { body: `args: ${toTrimmedString(toolInput.args, 400)}` } : {}),
            metadata: {
                ...buildSemanticMetadata({
                    subtypeKey: "skill_use",
                    subtypeLabel: "Skill use",
                    subtypeGroup: "coordination",
                    toolFamily: "coordination",
                    operation: "invoke",
                    entityType: "skill",
                    entityName: skillName,
                    sourceTool: toolName
                }),
                ...metadata
            },
            ...(skillName ? { skillName } : {})
        });
        return;
    }
    const description = toTrimmedString(toolInput.description);
    const prompt = toTrimmedString(toolInput.prompt, 400);
    const runInBackground = toBoolean(toolInput.run_in_background);
    const agentName = toTrimmedString(toolInput.subagent_type);
    const title = description ? `Agent: ${description.slice(0, 80)}` : "Agent dispatch";
    await postJson("/api/agent-activity", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        activityType: "delegation",
        title,
        ...(prompt || description ? { body: prompt || description } : {}),
        metadata: {
            ...buildSemanticMetadata({
                subtypeKey: "delegation",
                subtypeLabel: "Delegation",
                subtypeGroup: "coordination",
                toolFamily: "coordination",
                operation: "delegate",
                entityType: "agent",
                entityName: agentName || description,
                sourceTool: toolName
            }),
            ...metadata
        },
        ...(agentName ? { agentName } : {})
    });
    hookLog("agent_activity", "agent-activity posted", { activityType: "delegation", title });
    if (!runInBackground)
        return;
    const childSessionId = extractChildSessionId(payload.tool_response);
    if (!childSessionId)
        return;
    const childTitle = description || prompt || defaultTaskTitle();
    const childIds = getCachedSessionResult(childSessionId) ?? await (async () => {
        const fresh = await ensureRuntimeSession(childSessionId, childTitle);
        cacheSessionResult(childSessionId, fresh);
        return fresh;
    })();
    await postJson("/api/task-link", {
        taskId: childIds.taskId,
        taskKind: "background",
        parentTaskId: ids.taskId,
        parentSessionId: ids.sessionId,
        title: childTitle
    });
    hookLog("agent_activity", "task-link posted", { childSessionId, childTitle });
}
void main().catch((err: unknown) => {
    hookLog("agent_activity", "ERROR", { error: String(err) });
});

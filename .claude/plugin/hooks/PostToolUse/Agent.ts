/**
 * Claude Code Hook: PostToolUse — matcher: "Agent|Skill"
 *
 * Fires after an Agent or Skill tool call succeeds.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#posttooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PostToolUse"
 *   tool_name        string  — "Agent" or "Skill"
 *   tool_input       object  — tool-specific input (see below)
 *   tool_response    any     — agent/skill output text or structured result
 *   tool_use_id      string  — unique ID for this tool invocation
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * Agent tool_input fields:
 *   prompt           string   — task description for the spawned agent
 *   description      string?  — short human-readable description
 *   subagent_type    string?  — named agent type (e.g. "Explore", "code-reviewer")
 *   run_in_background boolean? — if true, agent runs async; tool_response contains session_id
 *   model            string?  — model override
 *
 * Skill tool_input fields:
 *   skill            string   — skill name to invoke
 *   args             string?  — optional arguments passed to the skill
 *
 * Blocking: PostToolUse cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler posts an /api/agent-activity event (activityType: "delegation" or
 * "skill_use"). For background agents, it additionally posts /api/task-link to
 * connect the child session task to the parent task in the monitor.
 */
import { buildSemanticMetadata, defaultTaskTitle, getSessionId, getToolInput, hookLog, hookLogPayload, postJson, readStdinJson, resolveSessionIds, stringifyToolInput, toBoolean, toTrimmedString } from "../common.js";

function extractChildSessionId(toolResponse: unknown): string {
    const text = typeof toolResponse === "string"
        ? toolResponse
        : JSON.stringify(toolResponse ?? {});
    const match = /session_id[:\s]+([a-f0-9-]{8,})/i.exec(text);
    return match?.[1]?.trim() ?? "";
}

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PostToolUse/Agent", payload);
    const toolName = toTrimmedString(payload.tool_name);
    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    hookLog("PostToolUse/Agent", "fired", { toolName, sessionId: sessionId || "(none)" });

    if (!sessionId || (toolName !== "Agent" && toolName !== "Skill")) {
        hookLog("PostToolUse/Agent", "skipped — not Agent/Skill or no sessionId");
        return;
    }

    const ids = await resolveSessionIds(sessionId);
    const metadata = { toolInput: stringifyToolInput(toolInput) };

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
    hookLog("PostToolUse/Agent", "agent-activity posted", { activityType: "delegation", title });

    if (!runInBackground) return;

    const childSessionId = extractChildSessionId(payload.tool_response);
    if (!childSessionId) return;

    const childTitle = description || prompt || defaultTaskTitle();
    const childIds = await resolveSessionIds(childSessionId, childTitle);
    await postJson("/api/task-link", {
        taskId: childIds.taskId,
        taskKind: "background",
        parentTaskId: ids.taskId,
        parentSessionId: ids.sessionId,
        title: childTitle
    });
    hookLog("PostToolUse/Agent", "task-link posted", { childSessionId, childTitle });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Agent", "ERROR", { error: String(err) });
});

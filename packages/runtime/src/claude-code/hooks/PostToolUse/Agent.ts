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
 * "skill_use"). For background agents, it resolves the child runtime session with
 * parentTaskId/parentSessionId so the monitor creates the child as a background task
 * on first ensure.
 */
import {defaultTaskTitle} from "~claude-code/hooks/util/paths.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {toBoolean, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {resolveBackgroundSessionIds, resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {KIND} from "~shared/events/kinds.js";
import {type AgentActivityMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferAgentSemantic, inferSkillSemantic} from "~shared/semantics/inference.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";
import {postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";

function extractChildSessionId(toolResponse: unknown): string {
    const text = typeof toolResponse === "string"
        ? toolResponse
        : JSON.stringify(toolResponse ?? {});
    const match = /session_id[:\s]+([a-f0-9-]{8,})/i.exec(text);
    return match?.[1]?.trim() ?? "";
}

async function main(): Promise<void> {
    const {
        payload,
        sessionId,
        agentId,
        agentType,
        toolName,
        toolInput,
        toolUseId
    } = await readToolHookContext("PostToolUse/Agent");
    hookLog("PostToolUse/Agent", "fired", {toolName, sessionId: sessionId || "(none)"});

    if (!sessionId || (toolName !== "Agent" && toolName !== "Skill")) {
        hookLog("PostToolUse/Agent", "skipped — not Agent/Skill or no sessionId");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const baseEvidence = {
        ...provenEvidence("Observed directly by the Agent PostToolUse hook."),
        toolInput: stringifyToolInput(toolInput),
        ...(toolUseId ? {toolUseId} : {}),
    };

    if (toolName === "Skill") {
        const skillName = toTrimmedString(toolInput.skill);
        const semantic = inferSkillSemantic(skillName, "Skill")
        const baseSkillMeta: AgentActivityMetadata = {
            ...baseEvidence,
            ...buildSemanticMetadata(semantic),
            activityType: "skill_use",
            ...(skillName ? {skillName} : {}),
        };
        await postTaggedEvent({
            kind: KIND.agentActivityLogged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.coordination,
            title: skillName ? `Skill: ${skillName}` : "Skill invoked",
            ...(toTrimmedString(toolInput.args) ? {body: `args: ${toTrimmedString(toolInput.args, 400)}`} : {}),
            metadata: baseSkillMeta,
        });
        return;
    }

    const description = toTrimmedString(toolInput.description);
    const prompt = toTrimmedString(toolInput.prompt, 400);
    const runInBackground = toBoolean(toolInput.run_in_background);
    const agentName = toTrimmedString(toolInput.subagent_type);
    const semantic = inferAgentSemantic(agentName || undefined, "Agent")
    const title = description ? `Agent: ${description.slice(0, 80)}` : "Agent dispatch";
    const baseAgentMeta: AgentActivityMetadata = {
        ...baseEvidence,
        ...buildSemanticMetadata(semantic),
        activityType: "delegation",
        ...(agentName ? {agentName} : {}),
    };
    await postTaggedEvent({
        kind: KIND.agentActivityLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.coordination,
        title,
        ...(prompt || description ? {body: prompt || description} : {}),
        metadata: baseAgentMeta,
    });
    hookLog("PostToolUse/Agent", "agent-activity posted", {activityType: "delegation", title});

    if (!runInBackground) return;

    const childSessionId = extractChildSessionId(payload.tool_response);
    if (!childSessionId) return;

    const childTitle = description || prompt || defaultTaskTitle();
    await resolveBackgroundSessionIds(sessionId, childSessionId, childTitle, ids);
    hookLog("PostToolUse/Agent", "background child session ensured", {
        childSessionId,
        childTitle,
        parentTaskId: ids.taskId
    });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Agent", "ERROR", {error: String(err)});
});

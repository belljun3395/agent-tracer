/**
 * Shared logic for the Skill PostToolUse handler.
 *
 * Skill tool_input fields:
 *   skill  string — skill name to invoke
 *   args   string? — optional arguments
 */
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent} from "./_shared.js";
import type {PostToolUseHandlerArgs} from "./_shared.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type AgentActivityMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferSkillSemantic} from "~shared/semantics/inference.js";

export async function postSkillEvent({payload, ids}: PostToolUseHandlerArgs): Promise<void> {
    const skillName = toTrimmedString(payload.toolInput["skill"]);
    const semantic = inferSkillSemantic(skillName, "Skill");

    const metadata: AgentActivityMetadata = {
        ...provenEvidence("Observed directly by the Skill PostToolUse hook."),
        toolInput: stringifyToolInput(payload.toolInput),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
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
        ...(toTrimmedString(payload.toolInput["args"])
            ? {body: `args: ${toTrimmedString(payload.toolInput["args"], 400)}`}
            : {}),
        metadata,
    });
}

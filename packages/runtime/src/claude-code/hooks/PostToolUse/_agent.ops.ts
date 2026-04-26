/**
 * Shared logic for the Agent PostToolUse handler. Split out so Agent.ts can
 * stay thin and satisfy the "PascalCase = official tool identifier" rule.
 *
 * Agent tool_input fields:
 *   prompt            string
 *   description       string?
 *   subagent_type     string?
 *   run_in_background boolean?
 *   model             string?
 */
import {defaultTaskTitle} from "~claude-code/hooks/util/paths.js";
import {stringifyToolInput} from "~claude-code/hooks/util/payload.js";
import {toBoolean, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent} from "./_shared.js";
import type {PostToolUseHandlerArgs} from "./_shared.js";
import {resolveBackgroundSessionIds} from "~claude-code/hooks/Agent/session.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { AgentActivityMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { inferAgentSemantic } from "~shared/semantics/inference.coordination.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

function extractChildSessionId(toolResponse: unknown): string {
    const text = typeof toolResponse === "string" ? toolResponse : JSON.stringify(toolResponse ?? {});
    const match = /session_id[:\s]+([a-f0-9-]{8,})/i.exec(text);
    return match?.[1]?.trim() ?? "";
}

export async function postAgentEvent({payload, ids}: PostToolUseHandlerArgs): Promise<void> {
    const description = toTrimmedString(payload.toolInput["description"]);
    const prompt = toTrimmedString(payload.toolInput["prompt"], 400);
    const runInBackground = toBoolean(payload.toolInput["run_in_background"]);
    const agentName = toTrimmedString(payload.toolInput["subagent_type"]);
    const semantic = inferAgentSemantic(agentName || undefined, "Agent");
    const title = description ? `Agent: ${description.slice(0, 80)}` : "Agent dispatch";

    const metadata: AgentActivityMetadata = {
        ...provenEvidence("Observed directly by the Agent PostToolUse hook."),
        toolInput: stringifyToolInput(payload.toolInput),
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
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
        metadata,
    });

    if (!runInBackground) return;

    const childSessionId = extractChildSessionId(payload.toolResponse);
    if (!childSessionId) return;

    const childTitle = description || prompt || defaultTaskTitle();
    await resolveBackgroundSessionIds(payload.sessionId, childSessionId, childTitle, ids);
}

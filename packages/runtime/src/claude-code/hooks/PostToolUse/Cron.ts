/**
 * Claude Code Hook: PostToolUse — matcher: "CronCreate|CronDelete|CronList"
 *
 * CronCreate schedules a recurring or one-shot prompt. Captured as a
 * coordination signal — it shapes future behaviour in the session.
 * CronDelete cancels by id; CronList is a read-only enumeration.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { AgentActivityMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("Cron", async ({payload, ids}) => {
    const toolName = payload.toolName;
    const cronId = toTrimmedString(payload.toolInput["id"]);
    const schedule = toTrimmedString(payload.toolInput["schedule"]);
    const promptArg = toTrimmedString(payload.toolInput["prompt"], 200);
    const title = toolName === "CronCreate"
        ? `Cron schedule: ${schedule || "?"}`
        : toolName === "CronDelete"
            ? `Cron delete: ${cronId || "?"}`
            : "Cron list";
    const body = toolName === "CronCreate" && promptArg
        ? `Schedule: ${schedule}\nPrompt: ${promptArg}`
        : toolName === "CronDelete"
            ? `Cancel scheduled task ${cronId}`
            : "Enumerated scheduled tasks";

    const metadata: AgentActivityMetadata = {
        ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
        ...buildSemanticMetadata({
            subtypeKey: "delegation",
            subtypeLabel: `Cron ${toolName.replace(/^Cron/, "").toLowerCase()}`,
            subtypeGroup: "coordination",
            toolFamily: "coordination",
            operation: toolName.replace(/^Cron/, "").toLowerCase() || "list",
            entityType: "cron",
            ...(cronId ? {entityName: cronId} : schedule ? {entityName: schedule} : {}),
            sourceTool: toolName,
        }),
        activityType: "delegation",
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.agentActivityLogged,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.coordination,
        title,
        body,
        metadata,
    });
});

/**
 * Claude Code Hook: PostToolUse — matcher: "KillShell"
 *
 * Kills a background bash session by id. Captured as an implementation event
 * because it changes execution state.
 *
 * Tool input fields:
 *   bash_id  string
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ToolUsedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("KillShell", async ({payload, ids}) => {
    const bashId = toTrimmedString(payload.toolInput["bash_id"]) || "?";
    const metadata: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the KillShell PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "run_command",
            subtypeLabel: "Kill background shell",
            subtypeGroup: "execution",
            toolFamily: "terminal",
            operation: "execute",
            entityType: "shell",
            entityName: bashId,
            sourceTool: "KillShell",
        }),
        toolName: "KillShell",
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.implementation,
        title: `KillShell: ${bashId}`,
        body: `Terminated background shell ${bashId}`,
        metadata,
    });
});

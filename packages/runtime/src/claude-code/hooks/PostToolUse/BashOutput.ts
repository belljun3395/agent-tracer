/**
 * Claude Code Hook: PostToolUse — matcher: "BashOutput"
 *
 * Reads incremental output from a background-launched Bash process.
 * Treated as an exploration-class read against an already-running shell.
 *
 * Tool input fields:
 *   bash_id  string — id of the background bash session
 *   filter   string? — line filter regex
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ToolUsedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("BashOutput", async ({payload, ids}) => {
    const bashId = toTrimmedString(payload.toolInput["bash_id"]) || "?";
    const filter = toTrimmedString(payload.toolInput["filter"]);
    const title = `BashOutput: ${bashId}${filter ? ` /${filter}/` : ""}`;

    const metadata: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the BashOutput PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "shell_probe",
            subtypeLabel: "Background shell read",
            subtypeGroup: "shell",
            toolFamily: "terminal",
            operation: "read",
            entityType: "shell",
            entityName: bashId,
            sourceTool: "BashOutput",
        }),
        toolName: "BashOutput",
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.exploration,
        title,
        body: `Read output from background shell ${bashId}${filter ? ` (filter ${filter})` : ""}`,
        metadata,
    });
});

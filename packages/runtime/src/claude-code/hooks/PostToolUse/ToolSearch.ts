/**
 * Claude Code Hook: PostToolUse — matcher: "ToolSearch"
 *
 * ToolSearch loads deferred MCP tools by query. The interesting signal is
 * "agent went looking for capability X" — captured as exploration.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { ToolUsedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import { buildSemanticMetadata } from "~shared/semantics/inference.util.js";

await runPostToolUseHook("ToolSearch", async ({payload, ids}) => {
    const query = toTrimmedString(payload.toolInput["query"]);
    const title = query ? `ToolSearch: ${query.slice(0, 60)}` : "ToolSearch";

    const metadata: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the ToolSearch PostToolUse hook."),
        ...buildSemanticMetadata({
            subtypeKey: "list_files",
            subtypeLabel: "Tool search",
            subtypeGroup: "search",
            toolFamily: "explore",
            operation: "search",
            entityType: "query",
            ...(query ? {entityName: query} : {}),
            sourceTool: "ToolSearch",
        }),
        toolName: "ToolSearch",
        ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.exploration,
        title,
        body: query ? `Searched deferred tools for: ${query}` : "Listed deferred tools",
        metadata,
    });
});

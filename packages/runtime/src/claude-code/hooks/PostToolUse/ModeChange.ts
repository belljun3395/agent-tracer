/**
 * Claude Code Hook: PostToolUse — matcher: "EnterPlanMode|EnterWorktree|ExitWorktree"
 *
 * Plan-mode entry, worktree enter/exit. EnterPlanMode is the bookend pair
 * to ExitPlanMode (already routed via _explore.ops). The worktree pair
 * frames isolation context shifts.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {postTaggedEvent, runPostToolUseHook} from "./_shared.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runPostToolUseHook("ModeChange", async ({payload, ids}) => {
    const toolName = payload.toolName;
    const path = toTrimmedString(payload.toolInput["path"]);
    let title: string;
    let body: string;
    let lane: typeof LANE[keyof typeof LANE] = LANE.planning;
    if (toolName === "EnterPlanMode") {
        title = "Enter plan mode";
        body = "Switched to plan mode";
    } else if (toolName === "EnterWorktree") {
        title = path ? `Enter worktree: ${path}` : "Enter worktree";
        body = path ? `Switched into worktree at ${path}` : "Switched into worktree";
        lane = LANE.background;
    } else {
        title = "Exit worktree";
        body = "Returned from worktree to original directory";
        lane = LANE.background;
    }

    await postTaggedEvent({
        kind: KIND.contextSaved,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane,
        title,
        body,
        metadata: {
            ...provenEvidence(`Observed directly by the ${toolName} PostToolUse hook.`),
            trigger: `mode_change:${toolName}`,
            ...(payload.toolUseId ? {toolUseId: payload.toolUseId} : {}),
        },
    });
});

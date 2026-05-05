/**
 * Claude Code Hook: WorktreeRemove
 *
 * Ref: https://code.claude.com/docs/en/hooks#worktreeremove
 *
 * Fires when a worktree is being removed (at session exit or subagent
 * finish). Output and exit code are ignored — purely observational.
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "WorktreeRemove"
 *   worktree_path    string
 */
import * as path from "node:path";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {readWorktree} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { WorktreeMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("WorktreeRemove", {
    logger: claudeHookRuntime.logger,
    parse: readWorktree,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const relPath = relativeProjectPath(payload.worktreePath);

        const metadata: WorktreeMetadata = {
            ...provenEvidence("Observed directly by the WorktreeRemove hook."),
            worktreePath: payload.worktreePath,
            ...(relPath ? {relPath} : {}),
            worktreeAction: "remove",
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.worktreeRemove,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.background,
            title: `Worktree removed: ${path.basename(relPath || payload.worktreePath)}`,
            body: relPath || payload.worktreePath,
            metadata,
        });
    },
});

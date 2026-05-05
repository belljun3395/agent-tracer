/**
 * Claude Code Hook: WorktreeCreate
 *
 * Ref: https://code.claude.com/docs/en/hooks#worktreecreate
 *
 * Fires when a worktree is being created via `--worktree` or
 * `isolation: "worktree"` (e.g. by an agent task with isolation).
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "WorktreeCreate"
 *   worktree_path    string — target directory
 *
 * Blocking: Yes (non-zero exit aborts worktree creation). This handler
 * always succeeds — it's purely observational. Note that the real plugin
 * still needs to print the worktree path to stdout if it wants to control
 * placement; agent-tracer does NOT do that and lets the default handler win.
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

await runHook("WorktreeCreate", {
    logger: claudeHookRuntime.logger,
    parse: readWorktree,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const relPath = relativeProjectPath(payload.worktreePath);

        const metadata: WorktreeMetadata = {
            ...provenEvidence("Observed directly by the WorktreeCreate hook."),
            worktreePath: payload.worktreePath,
            ...(relPath ? {relPath} : {}),
            worktreeAction: "create",
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.worktreeCreate,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.background,
            title: `Worktree created: ${path.basename(relPath || payload.worktreePath)}`,
            body: relPath || payload.worktreePath,
            metadata,
        });
    },
});

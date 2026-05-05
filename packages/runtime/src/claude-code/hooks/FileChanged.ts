/**
 * Claude Code Hook: FileChanged
 *
 * Ref: https://code.claude.com/docs/en/hooks#filechanged
 *
 * Fires when a watched file changes on disk. Matcher in hooks.json uses
 * literal pipe-separated filenames (NOT regex), e.g. ".envrc|.env".
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "FileChanged"
 *   file_path        string
 *
 * Blocking: No.
 */
import * as path from "node:path";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {readFileChanged} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { FileChangedMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("FileChanged", {
    logger: claudeHookRuntime.logger,
    parse: readFileChanged,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const relPath = relativeProjectPath(payload.filePath);

        const metadata: FileChangedMetadata = {
            ...provenEvidence("Observed directly by the FileChanged hook."),
            filePath: payload.filePath,
            ...(relPath ? {relPath} : {}),
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.fileChanged,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.background,
            title: `File changed: ${path.basename(relPath || payload.filePath)}`,
            body: relPath || payload.filePath,
            filePaths: [payload.filePath],
            metadata,
        });
    },
});

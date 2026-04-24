/**
 * Claude Code Hook: InstructionsLoaded
 *
 * Ref: https://code.claude.com/docs/en/hooks#instructionsloaded
 *
 * Fires when a CLAUDE.md or .claude/rules/*.md file is loaded into context.
 *
 * Matchers: session_start | nested_traversal | path_glob_match | include | compact
 *
 * Stdin payload fields:
 *   session_id        string
 *   hook_event_name   string — "InstructionsLoaded"
 *   file_path         string
 *   memory_type       string — User | Project | Local | Managed
 *   load_reason       string
 *   globs             string[]?
 *   trigger_file_path string?
 *   parent_file_path  string?
 *
 * Blocking: No.
 */
import * as path from "node:path";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readInstructionsLoaded} from "~shared/hooks/claude/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type InstructionsLoadedMetadata} from "~shared/events/metadata.js";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("InstructionsLoaded", {
    logger: claudeHookRuntime.logger,
    parse: readInstructionsLoaded,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        if (!payload.filePath) return;

        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
        const relPath = relativeProjectPath(payload.filePath);
        const fileName = path.basename(payload.filePath);
        const loadReason = payload.loadReason ?? "session_start";
        const memoryType = payload.memoryType ?? "Project";
        const title = loadReason === "compact"
            ? `Instructions reloaded: ${fileName}`
            : `Instructions loaded: ${fileName}`;

        const metadata: InstructionsLoadedMetadata = {
            ...provenEvidence("Observed directly by the InstructionsLoaded hook."),
            filePath: payload.filePath,
            relPath,
            loadReason,
            memoryType,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.instructionsLoaded,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title,
            body: relPath,
            lane: LANE.planning,
            metadata,
        });
    },
});

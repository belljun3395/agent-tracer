/**
 * Claude Code Hook: InstructionsLoaded
 *
 * Fires when a CLAUDE.md or .claude/rules/*.md file is loaded into context.
 * Fires at session start (eagerly-loaded files) and lazily during the session.
 *
 * Stdin payload fields:
 *   session_id        string  — unique session identifier
 *   hook_event_name   string  — "InstructionsLoaded"
 *   file_path         string  — absolute path of the loaded instruction file
 *   memory_type       string  — "Project" | "User" | "Enterprise"
 *   load_reason       string  — "session_start" | "nested_traversal" | "path_glob_match" | "include" | "compact"
 *   cwd               string  — current working directory
 *   transcript_path   string  — path to the session transcript JSONL
 *   agent_id          string?  — set when inside a subagent
 *   agent_type        string?  — subagent type when agent_id is present
 *   globs             string[]? — path glob patterns (for path_glob_match reason)
 *   trigger_file_path string?  — file that triggered lazy load
 *   parent_file_path  string?  — file that included this one
 *
 * NOTE: InstructionsLoaded has NO decision control. Cannot block or modify loading.
 * Use only for observability. Always exit 0.
 *
 * This handler posts an instructions.loaded event to the Agent Tracer monitor
 * so the dashboard can show which instruction files are active in the session.
 */
import * as path from "node:path";
import {KIND} from "~shared/events/kinds.js";
import {LANE} from "~shared/events/lanes.js";
import {type InstructionsLoadedMetadata} from "~shared/events/metadata.js";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readHookSessionContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";

async function main(): Promise<void> {
    const {payload, sessionId, agentId, agentType} = await readHookSessionContext("InstructionsLoaded");

    if (!sessionId) {
        hookLog("InstructionsLoaded", "skipped — no sessionId");
        return;
    }

    const filePath = toTrimmedString(payload.file_path);
    const loadReason = toTrimmedString(payload.load_reason) || "session_start";
    const memoryType = toTrimmedString(payload.memory_type) || "Project";

    if (!filePath) {
        hookLog("InstructionsLoaded", "skipped — no file_path");
        return;
    }

    const relPath = relativeProjectPath(filePath);
    const fileName = path.basename(filePath);

    // compact reloads are re-registrations of already-known files; label them distinctly
    const title = loadReason === "compact"
        ? `Instructions reloaded: ${fileName}`
        : `Instructions loaded: ${fileName}`;

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);

    const baseMeta: InstructionsLoadedMetadata = {
        ...provenEvidence("Observed directly by the InstructionsLoaded hook."),
        filePath,
        relPath,
        loadReason,
        memoryType,
    };
    await postTaggedEvent({
        kind: KIND.instructionsLoaded,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title,
        body: relPath,
        lane: LANE.planning,
        metadata: baseMeta,
    });

    hookLog("InstructionsLoaded", "posted", {relPath, loadReason, memoryType});
}

void main().catch((err: unknown) => {
    hookLog("InstructionsLoaded", "ERROR", {error: String(err)});
});

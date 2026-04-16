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
import {
    getSessionId,
    hookLog,
    hookLogPayload,
    LANE,
    postJson,
    readStdinJson,
    relativeProjectPath,
    resolveEventSessionIds,
    toTrimmedString,
} from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("InstructionsLoaded", payload);
    const sessionId = getSessionId(payload);

    if (!sessionId) {
        hookLog("InstructionsLoaded", "skipped — no sessionId");
        return;
    }

    const agentId = toTrimmedString(payload.agent_id) || undefined;
    const agentType = toTrimmedString(payload.agent_type) || undefined;
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

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "instructions.loaded",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            title,
            body: relPath,
            lane: LANE.planning,
            metadata: {
                filePath,
                relPath,
                loadReason,
                memoryType,
            },
        }],
    });

    hookLog("InstructionsLoaded", "posted", { relPath, loadReason, memoryType });
}

void main().catch((err: unknown) => {
    hookLog("InstructionsLoaded", "ERROR", { error: String(err) });
});

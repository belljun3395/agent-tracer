/**
 * Claude Code Hook: PostToolUse — matcher: "Edit|Write"
 *
 * Fires after a file-write tool call succeeds.
 * Does not fire on failures — PostToolUseFailure.ts handles that.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#posttooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PostToolUse"
 *   tool_name        string  — "Edit" | "Write"
 *   tool_input       object  — tool-specific input (see below)
 *   tool_response    any     — tool result (not used here)
 *   tool_use_id      string  — unique ID for this tool invocation
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * Edit/Write tool_input fields:
 *   file_path        string  — absolute path of the file being modified
 *
 * Blocking: PostToolUse cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler posts a raw /ingest/v1/events event with kind "tool.used" —
 * the server classifies the file operation semantically at ingestion time via
 * @monitor/classification. Plugin sends raw payload only.
 */
import * as path from "node:path";
import { relativeProjectPath } from "../util/paths.js";
import { getAgentContext, getSessionId, getToolInput, getToolName, getToolUseId, toTrimmedString } from "../util/utils.js";
import { postJson, readStdinJson } from "../lib/transport.js";
import { resolveEventSessionIds } from "../lib/subagent-session.js";
import { hookLog, hookLogPayload } from "../lib/hook-log.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PostToolUse/File", payload);
    const toolName = getToolName(payload);
    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    const { agentId, agentType } = getAgentContext(payload);
    hookLog("PostToolUse/File", "fired", { toolName, sessionId: sessionId || "(none)" });

    if (!sessionId || !toolName) {
        hookLog("PostToolUse/File", "skipped — missing sessionId or toolName");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const toolUseId = getToolUseId(payload);
    const filePath = toTrimmedString(toolInput.file_path) || toTrimmedString(toolInput.path) || "";
    const relPath = filePath ? relativeProjectPath(filePath) : "";
    const title = relPath ? `${toolName}: ${path.basename(relPath)}` : toolName;
    const body = relPath ? `Modified ${relPath}` : `Used ${toolName}`;

    await postJson("/ingest/v1/events", {
        events: [{
            kind: "tool.used",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            toolName,
            title,
            body,
            ...(filePath ? { filePaths: [filePath] } : {}),
            metadata: {
                ...(filePath ? { filePath, relPath } : {}),
                ...(toolUseId ? { toolUseId } : {})
            }
        }]
    });
    hookLog("PostToolUse/File", "tool-used posted", { toolName, title });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/File", "ERROR", { error: String(err) });
});

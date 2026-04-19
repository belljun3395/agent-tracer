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
 * This handler posts a /ingest/v1/events event with kind "tool.used" and
 * attaches implementation-lane file-operation semantics from the runtime.
 */
import * as path from "node:path";
import {relativeProjectPath} from "~claude-code/hooks/util/paths.js";
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {KIND} from "~shared/events/kinds.js";
import {type ToolUsedMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferFileToolSemantic} from "~shared/semantics/inference.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";

async function main(): Promise<void> {
    const {
        sessionId,
        agentId,
        agentType,
        toolName,
        toolInput,
        toolUseId
    } = await readToolHookContext("PostToolUse/File");
    hookLog("PostToolUse/File", "fired", {toolName, sessionId: sessionId || "(none)"});

    if (!sessionId || !toolName) {
        hookLog("PostToolUse/File", "skipped — missing sessionId or toolName");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const filePath = toTrimmedString(toolInput.file_path) || toTrimmedString(toolInput.path) || "";
    const relPath = filePath ? relativeProjectPath(filePath) : "";
    const semantic = inferFileToolSemantic(toolName, relPath || undefined)
    const title = relPath ? `${toolName}: ${path.basename(relPath)}` : toolName;
    const body = relPath ? `Modified ${relPath}` : `Used ${toolName}`;

    const baseMeta: ToolUsedMetadata = {
        ...provenEvidence("Observed directly by the File PostToolUse hook."),
        ...buildSemanticMetadata(semantic),
        toolName,
        ...(filePath ? {filePath, relPath} : {}),
        ...(toolUseId ? {toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.toolUsed,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.implementation,
        title,
        body,
        ...(filePath ? {filePaths: [filePath]} : {}),
        metadata: baseMeta,
    });
    hookLog("PostToolUse/File", "tool-used posted", {toolName, title});
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/File", "ERROR", {error: String(err)});
});

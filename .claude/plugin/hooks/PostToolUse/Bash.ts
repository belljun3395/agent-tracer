/**
 * Claude Code Hook: PostToolUse — matcher: "Bash"
 *
 * Fires after a Bash tool call succeeds (command executed without error).
 * Does not fire on failures — PostToolUseFailure.ts handles that.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#posttooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PostToolUse"
 *   tool_name        string  — "Bash"
 *   tool_input       object  — Bash tool input (see below)
 *   tool_response    any     — stdout/stderr of the command (not used here)
 *   tool_use_id      string  — unique ID for this tool invocation
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * Bash tool_input fields:
 *   command          string   — shell command to run
 *   description      string?  — human-readable description of the command
 *   timeout          number?  — timeout in milliseconds
 *   run_in_background boolean? — whether to run asynchronously
 *
 * Blocking: PostToolUse cannot block (exit 2 shows stderr but execution continues).
 *
 * This handler classifies the shell command semantically (probe, test, build, lint,
 * verify, or generic run) and posts a /api/terminal-command event to the monitor.
 */
import { buildSemanticMetadata, getSessionId, getToolInput, hookLog, hookLogPayload, inferCommandSemantic, postJson, readStdinJson, resolveSessionIds, toTrimmedString } from "../common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PostToolUse/Bash", payload);
    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    const command = toTrimmedString(toolInput.command);
    const description = toTrimmedString(toolInput.description);
    hookLog("PostToolUse/Bash", "fired", { sessionId: sessionId || "(none)", cmdPreview: command.slice(0, 60) });

    if (!sessionId || !command) {
        hookLog("PostToolUse/Bash", "skipped — no sessionId or command");
        return;
    }

    const ids = await resolveSessionIds(sessionId);
    const semantic = inferCommandSemantic(command);

    await postJson("/api/terminal-command", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        command,
        title: description || command.slice(0, 80),
        body: description ? `${description}\n\n$ ${command}` : command,
        lane: semantic.lane,
        metadata: {
            description,
            command,
            ...buildSemanticMetadata(semantic.metadata)
        }
    });
    hookLog("PostToolUse/Bash", "terminal-command posted", { description: description || command.slice(0, 60) });
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Bash", "ERROR", { error: String(err) });
});

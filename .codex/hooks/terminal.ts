/**
 * PostToolUse (Bash) hook — records terminal command events.
 *
 * Codex payload for PostToolUse Bash:
 *   tool_input.command  — the shell command that ran
 *   tool_response       — stdout/stderr output (ignored here)
 *   session_id, cwd, model, turn_id
 */
import {
    buildSemanticMetadata,
    ensureRuntimeSession,
    getSessionId,
    getToolInput,
    hookLog,
    hookLogPayload,
    inferCommandSemantic,
    postJson,
    readStdinJson,
    setProjectDir,
    toTrimmedString
} from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("terminal", payload);

    const cwd = toTrimmedString(payload.cwd);
    if (cwd) setProjectDir(cwd);

    const toolInput = getToolInput(payload);
    const sessionId = getSessionId(payload);
    // Codex Bash tool uses `command` inside tool_input
    const command = toTrimmedString(toolInput.command);

    hookLog("terminal", "fired", { sessionId: sessionId || "(none)", cmdPreview: command.slice(0, 60) });

    if (!sessionId || !command) {
        hookLog("terminal", "skipped — no sessionId or command");
        return;
    }

    const ids = await ensureRuntimeSession(sessionId);
    const semantic = inferCommandSemantic(command);

    await postJson("/api/terminal-command", {
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        command,
        title: command.slice(0, 80),
        body: command,
        lane: semantic.lane,
        metadata: {
            command,
            ...buildSemanticMetadata(semantic.metadata)
        }
    });

    hookLog("terminal", "terminal-command posted", { cmd: command.slice(0, 60) });
}

void main().catch((err: unknown) => {
    hookLog("terminal", "ERROR", { error: String(err) });
});

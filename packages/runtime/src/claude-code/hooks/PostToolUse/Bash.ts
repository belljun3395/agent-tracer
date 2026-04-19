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
 * This handler posts a /ingest/v1/events event with kind "terminal.command"
 * and attaches the runtime-derived lane + semantic metadata.
 */
import {toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {readToolHookContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {KIND} from "~shared/events/kinds.js";
import {type TerminalCommandMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferCommandSemantic} from "~shared/semantics/inference.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";

async function main(): Promise<void> {
    const {sessionId, agentId, agentType, toolInput, toolUseId} = await readToolHookContext("PostToolUse/Bash");
    const command = toTrimmedString(toolInput.command);
    const description = toTrimmedString(toolInput.description);
    hookLog("PostToolUse/Bash", "fired", {sessionId: sessionId || "(none)", cmdPreview: command.slice(0, 60)});

    if (!sessionId || !command) {
        hookLog("PostToolUse/Bash", "skipped — no sessionId or command");
        return;
    }

    const ids = await resolveEventSessionIds(sessionId, agentId, agentType);
    const {lane, metadata: semantic} = inferCommandSemantic(command)

    const baseMeta: TerminalCommandMetadata = {
        ...provenEvidence("Observed directly by the Bash PostToolUse hook."),
        ...buildSemanticMetadata(semantic),
        command,
        ...(description ? {description} : {}),
        ...(toolUseId ? {toolUseId} : {}),
    };
    await postTaggedEvent({
        kind: KIND.terminalCommand,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane,
        title: description || command.slice(0, 80),
        body: description ? `${description}\n\n$ ${command}` : command,
        metadata: baseMeta,
    });
    hookLog("PostToolUse/Bash", "terminal-command posted", {description: description || command.slice(0, 60)});
}

void main().catch((err: unknown) => {
    hookLog("PostToolUse/Bash", "ERROR", {error: String(err)});
});

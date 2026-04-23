/**
 * Codex Hook: PostToolUse — matcher: "Bash"
 *
 * Fires after a Bash command completes (success or failure).
 * Matcher (hooks.json): "Bash" — runs only for Bash tool invocations.
 *
 * Stdin payload fields (ref: https://github.com/openai/codex#hooks):
 *   session_id       string  — unique session / thread identifier
 *   hook_event_name  string  — "PostToolUse"
 *   tool_name        string  — "Bash"
 *   tool_input       object  — Bash tool input (see below)
 *   tool_response    any     — stdout/stderr of the command (not used here)
 *
 * Bash tool_input fields:
 *   command          string  — shell command that was executed
 *   description      string? — human-readable description of the command
 *
 * Stdout: not consumed by Codex for PostToolUse hooks.
 *
 * Blocking: PostToolUse cannot block execution.
 *
 * This handler posts a terminalCommand event with kind "terminal.command"
 * and attaches the runtime-derived lane and semantic metadata inferred from
 * the command string (e.g. read vs. write vs. test vs. build).
 */
import {toTrimmedString} from "~codex/util/utils.js";
import {readToolHookContext} from "~codex/lib/hook/hook.context.js";
import {ensureRuntimeSession, postTaggedEvent} from "~codex/lib/transport/transport.js";
import {KIND} from "~shared/events/kinds.js";
import {type TerminalCommandMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {buildSemanticMetadata, inferCommandSemantic} from "~shared/semantics/inference.js";
import {hookLog} from "~codex/lib/hook/hook.log.js";

async function main(): Promise<void> {
    const {sessionId, toolInput, toolUseId} = await readToolHookContext("PostToolUse/Bash");
    const command = toTrimmedString(toolInput.command);
    const description = toTrimmedString(toolInput.description);
    hookLog("PostToolUse/Bash", "fired", {sessionId: sessionId || "(none)", cmdPreview: command.slice(0, 60)});

    if (!sessionId || !command) {
        hookLog("PostToolUse/Bash", "skipped — no sessionId or command");
        return;
    }

    const ids = await ensureRuntimeSession(sessionId);
    const {lane, metadata: semantic, analysis} = inferCommandSemantic(command);

    const baseMeta: TerminalCommandMetadata = {
        ...provenEvidence("Observed directly by the Codex PostToolUse/Bash hook."),
        ...buildSemanticMetadata(semantic),
        command,
        commandAnalysis: analysis,
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

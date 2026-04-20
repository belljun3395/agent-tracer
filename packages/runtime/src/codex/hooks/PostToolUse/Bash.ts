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
 *
 * Stdout: not consumed by Codex for PostToolUse hooks.
 *
 * Blocking: PostToolUse cannot block execution.
 *
 * This handler posts a terminalCommand event with kind "terminal.command"
 * and attaches the runtime-derived lane and semantic metadata inferred from
 * the command string (e.g. read vs. write vs. test vs. build).
 */
import { ensureRuntimeSession, postTaggedEvent, readStdinJson } from "~codex/lib/transport/transport.js";
import { toTrimmedString } from "~codex/util/utils.js";
import { KIND } from "~shared/events/kinds.js";
import { provenEvidence } from "~shared/semantics/evidence.js";
import { buildSemanticMetadata, inferCommandSemantic } from "~shared/semantics/inference.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    const sessionId = toTrimmedString(payload.session_id);
    const command = toTrimmedString(
        payload.tool_input && typeof payload.tool_input === "object" && "command" in payload.tool_input
            ? (payload.tool_input as { command?: unknown }).command
            : undefined,
    );
    if (!sessionId || !command) return;

    const ids = await ensureRuntimeSession(sessionId);
    const semantic = inferCommandSemantic(command);
    await postTaggedEvent({
        kind: KIND.terminalCommand,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        title: command.slice(0, 80),
        body: command,
        lane: semantic.lane,
        metadata: {
            ...provenEvidence("Observed directly by the Codex PostToolUse hook."),
            ...buildSemanticMetadata(semantic.metadata),
            command,
        },
    });
}

void main().catch((error: unknown) => {
    console.error(String(error));
});

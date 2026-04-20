/**
 * Codex Hook: PreToolUse — matcher: "Bash"
 *
 * Fires before a Bash command executes.
 * Matcher (hooks.json): "Bash" — runs only for Bash tool invocations.
 *
 * Stdin payload fields (ref: https://github.com/openai/codex#hooks):
 *   session_id       string  — unique session / thread identifier
 *   hook_event_name  string  — "PreToolUse"
 *   tool_name        string  — "Bash"
 *   tool_input       object  — the tool's input parameters (includes "command")
 *
 * Stdout: not consumed by Codex for PreToolUse hooks.
 *
 * Blocking: PreToolUse can block command execution (exit non-zero).
 * NOTE: This hook adds latency to every Bash command; the ensureRuntimeSession
 * call has an implicit 2-second HTTP timeout enforced by the transport layer.
 *
 * Purpose: guarantees that a runtime session and task exist in the monitor
 * before PostToolUse/Bash attempts to post events. Running the ensure here
 * avoids a race condition where PostToolUse could arrive before the session
 * is created.
 */
import {readToolHookContext} from "~codex/lib/hook/hook.context.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {hookLog} from "~codex/lib/hook/hook.log.js";

async function main(): Promise<void> {
    const {sessionId} = await readToolHookContext("PreToolUse");
    if (!sessionId) {
        hookLog("PreToolUse", "skipped — no sessionId");
        return;
    }
    await ensureRuntimeSession(sessionId);
    hookLog("PreToolUse", "ensureRuntimeSession ok", {sessionId});
}

void main().catch((err: unknown) => {
    hookLog("PreToolUse", "ERROR", {error: String(err)});
});

/**
 * Codex Hook: PreToolUse — matcher: "Bash"
 *
 * Ref: https://developers.openai.com/codex/hooks#pretooluse
 *
 * Stdin payload fields:
 *   session_id       string
 *   cwd              string
 *   hook_event_name  string — "PreToolUse"
 *   model            string
 *   turn_id          string
 *   tool_name        string — "Bash"
 *   tool_use_id      string
 *   tool_input       object (includes "command")
 *
 * Blocking: Yes (permissionDecision: "deny" or decision: "block").
 * This handler is observation-only and never blocks.
 *
 * Guarantees that a runtime session and task exist in the monitor before
 * PostToolUse/Bash attempts to post events.
 */
import {codexHookRuntime} from "~codex/lib/runtime.js";
import {ensureRuntimeSession} from "~codex/lib/transport/transport.js";
import {readCodexPreToolUse} from "~shared/hooks/codex/payloads.js";
import {runHook} from "~shared/hook-runtime/index.js";

await runHook("PreToolUse", {
    logger: codexHookRuntime.logger,
    parse: readCodexPreToolUse,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        await ensureRuntimeSession(payload.sessionId);
    },
});

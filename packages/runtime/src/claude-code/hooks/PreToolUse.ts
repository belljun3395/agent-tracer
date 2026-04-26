/**
 * Claude Code Hook: PreToolUse (no matcher — runs before every tool call)
 *
 * Ref: https://code.claude.com/docs/en/hooks#pretooluse
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "PreToolUse"
 *   tool_name        string
 *   tool_input       object
 *   tool_use_id      string
 *   cwd              string
 *   transcript_path  string
 *   permission_mode  string
 *   agent_id         string?
 *   agent_type       string?
 *
 * Blocking: Yes (exit 2 / permissionDecision: "deny"). This handler never blocks.
 *
 * Guarantees that a runtime session and task exist in the monitor before any
 * tool event is posted. For subagent sessions, resolveEventSessionIds
 * transparently creates a virtual child task via "sub--{agent_id}".
 *
 * NOTE: This hook runs synchronously before every tool, so latency matters.
 * The monitor HTTP call has a 2-second abort timeout; if the monitor is
 * unreachable the hook exits 0 and Claude proceeds unblocked.
 */
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {resolveEventSessionIds} from "~claude-code/hooks/Agent/session.js";
import {readPreToolUse} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";

await runHook("PreToolUse", {
    logger: claudeHookRuntime.logger,
    parse: readPreToolUse,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);
    },
});

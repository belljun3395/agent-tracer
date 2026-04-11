/**
 * Claude Code Hook: PreToolUse (all tools — no matcher)
 *
 * Fires before every tool call executes. No matcher is set, so this runs
 * before each and every tool invocation in the session.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#pretooluse):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "PreToolUse"
 *   tool_name        string  — name of the tool about to run (e.g. "Bash", "Edit")
 *   tool_input       object  — the tool's input parameters
 *   tool_use_id      string  — unique ID for this tool invocation
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *   agent_type       string? — subagent type when agent_id is present
 *
 * Stdout (optional JSON on exit 0):
 *   hookSpecificOutput.permissionDecision        "allow"|"deny"|"ask"|"defer"
 *   hookSpecificOutput.permissionDecisionReason  string
 *   hookSpecificOutput.updatedInput              object  — modified tool input
 *   hookSpecificOutput.additionalContext         string  — injected context
 *
 * Blocking: exit 2 prevents the tool from running.
 * NOTE: This hook runs synchronously before every tool, so it adds latency.
 *       The monitor HTTP call has a 2-second abort timeout; if the monitor is
 *       unreachable the hook exits 0 and Claude proceeds unblocked.
 *
 * Purpose: guarantees that a runtime session and task exist in the monitor
 * before any tool event is posted. For subagent sessions, resolveEventSessionIds
 * transparently creates a virtual child task via "sub--{agent_id}" on first call
 * (or returns the cached result on subsequent calls).
 */
import { getSessionId, hookLog, hookLogPayload, readStdinJson, resolveEventSessionIds, toTrimmedString } from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("PreToolUse", payload);
    const sessionId = getSessionId(payload);
    if (!sessionId) return;

    const agentId = toTrimmedString(payload.agent_id) || undefined;
    const agentType = toTrimmedString(payload.agent_type) || undefined;

    await resolveEventSessionIds(sessionId, agentId, agentType);
    hookLog("PreToolUse", "ensureRuntimeSession ok", { sessionId, agentId: agentId ?? "(none)" });
}

void main().catch((err: unknown) => {
    hookLog("PreToolUse", "ERROR", { error: String(err) });
});

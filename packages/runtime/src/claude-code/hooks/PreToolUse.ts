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
import {emitPreprocessingHints, fetchPreprocessingHints} from "~claude-code/hooks/lib/preprocessing-hints.js";
import {readPreToolUse} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";

await runHook("PreToolUse", {
    logger: claudeHookRuntime.logger,
    parse: readPreToolUse,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        const ids = await resolveEventSessionIds(payload.sessionId, payload.agentId, payload.agentType);

        // Build the detector input only for tools whose preprocessing we care
        // about (Bash/PowerShell command repetition+risk, AskUserQuestion dedup).
        // For everything else we just skip the hint fetch entirely so PreToolUse
        // stays cheap.
        const toolName = payload.toolName;
        if (!toolName) return;

        const command = (toolName === "Bash" || toolName === "PowerShell")
            ? toStringField(payload.toolInput, "command")
            : undefined;
        const questions = toolName === "AskUserQuestion"
            ? extractQuestions(payload.toolInput)
            : undefined;

        if (!command && (!questions || questions.length === 0)) return;

        const hints = await fetchPreprocessingHints(ids.taskId, {
            trigger: "pre_tool",
            toolName,
            ...(command ? {command} : {}),
            ...(questions && questions.length > 0 ? {questions} : {}),
        });
        emitPreprocessingHints("PreToolUse", hints);
    },
});

function toStringField(input: Record<string, unknown>, key: string): string | undefined {
    const value = input[key];
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}

function extractQuestions(input: Record<string, unknown>): readonly string[] {
    const questions = input["questions"];
    if (!Array.isArray(questions)) return [];
    const out: string[] = [];
    for (const item of questions) {
        if (!item || typeof item !== "object") continue;
        const text = (item as Record<string, unknown>)["question"];
        if (typeof text === "string" && text.trim()) out.push(text.trim());
    }
    return out;
}

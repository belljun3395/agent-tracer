/**
 * Claude Code Hook: UserPromptSubmit
 *
 * Fires when the user submits a prompt, before Claude processes it.
 * No matcher is supported — fires on every user prompt.
 *
 * Stdin payload fields (ref: https://code.claude.com/docs/en/hooks#userpromptsubmit):
 *   session_id       string  — unique session identifier
 *   hook_event_name  string  — "UserPromptSubmit"
 *   prompt           string  — the raw prompt text submitted by the user
 *   cwd              string  — current working directory
 *   transcript_path  string  — path to the session transcript JSONL
 *   permission_mode  string  — current permission mode
 *   agent_id         string? — set when inside a subagent
 *
 * Stdout (optional JSON on exit 0):
 *   decision                              "block"  — prevents Claude from processing the prompt
 *   reason                               string   — shown to user if blocked
 *   hookSpecificOutput.additionalContext  string   — injected into conversation context
 *   hookSpecificOutput.sessionTitle       string   — auto-generated session title override
 *
 * Blocking: exit 2 prevents Claude from processing the prompt.
 *
 * This handler ensures the runtime session exists (creating a new task on first message)
 * and records the user message in the Agent Tracer monitor. The "initial" vs "follow_up"
 * phase is derived from whether ensureRuntimeSession created a new task.
 */
import { createMessageId, defaultTaskTitle, ellipsize, ensureRuntimeSession, getSessionId, hookLog, hookLogPayload, postJson, readStdinJson, toTrimmedString } from "./common.js";

async function main(): Promise<void> {
    const payload = await readStdinJson();
    hookLogPayload("UserPromptSubmit", payload);
    const prompt = toTrimmedString(payload.prompt);
    const sessionId = getSessionId(payload);
    hookLog("UserPromptSubmit", "fired", { sessionId: sessionId || "(none)", promptLen: prompt.length });

    if (!sessionId) {
        hookLog("UserPromptSubmit", "skipped — no sessionId");
        return;
    }
    if (prompt.toLowerCase() === "/exit" || prompt.toLowerCase() === "exit") {
        hookLog("UserPromptSubmit", "skipped — exit command");
        return;
    }

    const title = prompt ? ellipsize(prompt, 120) : defaultTaskTitle();
    const ids = await ensureRuntimeSession(sessionId, title);
    hookLog("UserPromptSubmit", "ensureRuntimeSession ok", { taskId: ids.taskId });

    if (!prompt) return;

    const phase: "initial" | "follow_up" = ids.taskCreated ? "initial" : "follow_up";
    await postJson("/ingest/v1/events", {
        events: [{
            kind: "user.message",
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            messageId: createMessageId(),
            captureMode: "raw",
            source: "claude-plugin",
            phase,
            title,
            body: prompt
        }]
    });
    hookLog("UserPromptSubmit", "user-message posted", { title, phase });
}

void main().catch((err: unknown) => {
    hookLog("UserPromptSubmit", "ERROR", { error: String(err) });
});

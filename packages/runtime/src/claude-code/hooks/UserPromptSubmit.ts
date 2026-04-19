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
import {createMessageId, ellipsize, toTrimmedString} from "~claude-code/hooks/util/utils.js";
import {defaultTaskTitle} from "~claude-code/hooks/util/paths.js";
import {readHookSessionContext} from "~claude-code/hooks/lib/hook/hook.context.js";
import {ensureRuntimeSession, postTaggedEvent} from "~claude-code/hooks/lib/transport/transport.js";
import {KIND} from "~shared/events/kinds.js";
import {type UserMessageMetadata} from "~shared/events/metadata.js";
import {provenEvidence} from "~shared/semantics/evidence.js";
import {hookLog} from "~claude-code/hooks/lib/hook/hook.log.js";
import {LANE} from "~shared/events/lanes.js";

async function main(): Promise<void> {
    const {payload, sessionId} = await readHookSessionContext("UserPromptSubmit");
    const prompt = toTrimmedString(payload.prompt);
    hookLog("UserPromptSubmit", "fired", {sessionId: sessionId || "(none)", promptLen: prompt.length});

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
    hookLog("UserPromptSubmit", "ensureRuntimeSession ok", {taskId: ids.taskId});

    if (!prompt) return;

    const phase: "initial" | "follow_up" = ids.taskCreated ? "initial" : "follow_up";
    const baseMeta: UserMessageMetadata = {
        ...provenEvidence("Captured directly by the UserPromptSubmit hook."),
        messageId: createMessageId(),
        captureMode: "raw",
        source: "claude-plugin",
        phase,
    };
    await postTaggedEvent({
        kind: KIND.userMessage,
        taskId: ids.taskId,
        sessionId: ids.sessionId,
        lane: LANE.user,
        title,
        body: prompt,
        metadata: baseMeta,
    });
    hookLog("UserPromptSubmit", "user-message posted", {title, phase});
}

void main().catch((err: unknown) => {
    hookLog("UserPromptSubmit", "ERROR", {error: String(err)});
});

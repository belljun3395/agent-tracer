/**
 * Claude Code Hook: UserPromptSubmit
 *
 * Ref: https://code.claude.com/docs/en/hooks#userpromptsubmit
 *
 * Fires when the user submits a prompt, before Claude processes it.
 *
 * Stdin payload fields:
 *   session_id       string
 *   hook_event_name  string — "UserPromptSubmit"
 *   prompt           string
 *   cwd              string
 *   transcript_path  string
 *   permission_mode  string
 *
 * Blocking: Yes (exit 2 / decision: "block"). This handler never blocks.
 *
 * Ensures the runtime session exists (creating a new task on first message)
 * and records the user message.
 */
import {createMessageId, ellipsize} from "~claude-code/hooks/util/utils.js";
import {defaultTaskTitle} from "~claude-code/hooks/util/paths.js";
import {claudeHookRuntime} from "~claude-code/hooks/lib/runtime.js";
import {ensureRuntimeSession} from "~claude-code/hooks/lib/transport/transport.js";
import {emitPreprocessingHints, fetchPreprocessingHints} from "~claude-code/hooks/lib/preprocessing-hints.js";
import {emitRecipeContext, fetchRecipeMatches} from "~claude-code/hooks/lib/recipe-context.js";
import {readUserPromptSubmit} from "~shared/hooks/claude/payloads.js";
import { runHook } from "~shared/hook-runtime/run-hook.js";
import { KIND } from "~shared/events/kinds.const.js";
import { LANE } from "~shared/events/lanes.const.js";
import type { UserMessageMetadata } from "~shared/events/metadata.type.js";
import {provenEvidence} from "~shared/semantics/evidence.js";

await runHook("UserPromptSubmit", {
    logger: claudeHookRuntime.logger,
    parse: readUserPromptSubmit,
    handler: async (payload) => {
        if (!payload.sessionId) return;
        if (payload.prompt.toLowerCase() === "/exit" || payload.prompt.toLowerCase() === "exit") return;

        const title = payload.prompt ? ellipsize(payload.prompt, 120) : defaultTaskTitle();
        const ids = await ensureRuntimeSession(payload.sessionId, title);
        if (!payload.prompt) return;

        const phase: "initial" | "follow_up" = ids.taskCreated ? "initial" : "follow_up";
        const metadata: UserMessageMetadata = {
            ...provenEvidence("Captured directly by the UserPromptSubmit hook."),
            messageId: createMessageId(),
            captureMode: "raw",
            source: "claude-plugin",
            phase,
        };
        await claudeHookRuntime.transport.postTaggedEvent({
            kind: KIND.userMessage,
            taskId: ids.taskId,
            sessionId: ids.sessionId,
            lane: LANE.user,
            title,
            body: payload.prompt,
            metadata,
        });

        // Surface preprocessing hints (context pressure, etc.) so Claude Code
        // can take them into account before composing the next turn. Best
        // effort — fetch failures are swallowed inside the helper.
        const hints = await fetchPreprocessingHints(ids.taskId, {trigger: "user_prompt"});
        const emittedHints = emitPreprocessingHints("UserPromptSubmit", hints);

        // Inject matching past-task recipes as additionalContext. Only one
        // additionalContext block can be emitted per hook invocation — if
        // preprocessing already wrote one, recipes are skipped this turn.
        if (!emittedHints) {
            const matches = await fetchRecipeMatches(payload.prompt, {
                taskId: ids.taskId,
                injectedVia: "auto",
            });
            emitRecipeContext("UserPromptSubmit", matches);
        }
    },
});

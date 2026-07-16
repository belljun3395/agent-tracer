/** 사용자가 프롬프트를 내면 Claude가 처리하기 전에 실행되는 훅으로 발화를 남기고 규칙과 힌트와 레시피를 컨텍스트로 낸다. */
import {emitAgentContext} from "~runtime/agent/claude-code/hook.output.js";
import {readUserPromptSubmit} from "~runtime/agent/claude-code/payload/session.payload.js";
import {claudeRuntime, ensureClaudeSession, runHook} from "~runtime/agent/claude-code/runtime.js";
import {
    queryDaemonHints,
    queryDaemonRules,
    reportRecipeInjection,
} from "~runtime/daemon/ipc/hook.client.js";
import {onLifecycleEvent} from "~runtime/domain/ingest/inbound/tool.hook.js";
import {KIND} from "~runtime/domain/ingest/model/event.model.js";
import {userMessageEvent} from "~runtime/domain/ingest/model/message.event.model.js";
import {recipeInjectedEvent} from "~runtime/domain/ingest/model/recipe.injection.event.model.js";
import {isSystemNotificationPrompt} from "~runtime/domain/ingest/model/system.notification.model.js";
import {onPromptRecipes, onRecipeScanRequested} from "~runtime/domain/recipe/inbound/recipe.hook.js";
import {onTurnOpen} from "~runtime/domain/turn/inbound/turn.hook.js";
import {ellipsize} from "~runtime/support/text.js";
import {createMessageId, deterministicUlid, generateUlid} from "~runtime/support/ulid.js";

const EXIT_PROMPTS: ReadonlySet<string> = new Set(["/exit", "exit"]);
const TASK_TITLE_MAX = 120;
const INJECTED_VIA_AUTO = "auto";

await runHook("UserPromptSubmit", {
    parse: readUserPromptSubmit,
    handler: async (payload) => {
        if (EXIT_PROMPTS.has(payload.prompt.toLowerCase())) return;
        if (!payload.prompt) {
            await ensureClaudeSession(payload.sessionId, undefined, {
                transcriptPath: payload.transcriptPath,
            });
            return;
        }

        const systemNotification = isSystemNotificationPrompt(payload.prompt);
        const target = await ensureClaudeSession(
            payload.sessionId,
            systemNotification ? undefined : ellipsize(payload.prompt, TASK_TITLE_MAX),
            {transcriptPath: payload.transcriptPath},
        );
        const messageId = createMessageId();
        // Claude 훅 페이로드에는 턴 식별자가 없으므로 세션과 메시지에서 결정적으로 만든다.
        const turnId = deterministicUlid([
            claudeRuntime.runtimeSource,
            payload.sessionId,
            messageId,
            KIND.invokeAgent,
        ]);
        await onTurnOpen(claudeRuntime.turn, {
            runtimeSource: claudeRuntime.runtimeSource,
            runtimeSessionId: payload.sessionId,
            turnId,
            prompt: payload.prompt,
        });

        const eventId = generateUlid();
        await onLifecycleEvent(claudeRuntime.ingest, [
            userMessageEvent(target, {
                eventId,
                messageId,
                turnId,
                prompt: payload.prompt,
                phase: target.taskCreated ? "initial" : "follow_up",
                runtimeSource: claudeRuntime.runtimeSource,
                systemNotification,
            }),
        ]);

        await onRecipeScanRequested(claudeRuntime.recipe, {
            taskId: target.taskId,
            eventId,
            prompt: payload.prompt,
        });

        const [rules, hints] = await Promise.all([
            queryDaemonRules(target.taskId),
            queryDaemonHints(target.taskId, {trigger: "user_prompt"}),
        ]);
        // 알림 텍스트를 레시피와 매칭하면 소음이라 시스템 알림에는 레시피 컨텍스트를 비운다.
        const recipes = systemNotification ? undefined : onPromptRecipes(claudeRuntime.recipe, payload.prompt);
        const emission = emitAgentContext("UserPromptSubmit", {
            rules,
            hints,
            recipeContext: recipes?.context ?? "",
        });
        if (!emission.emitted || !recipes || recipes.matches.length === 0) return;

        await reportRecipeInjection(target.taskId, recipes.titles, emission.recipeBytes);
        await onLifecycleEvent(
            claudeRuntime.ingest,
            recipes.matches.map((match) => recipeInjectedEvent({...target, turnId}, {
                recipeId: match.recipeId,
                applicationId: generateUlid(),
                score: match.score,
                injectedVia: INJECTED_VIA_AUTO,
            })),
        );
    },
});

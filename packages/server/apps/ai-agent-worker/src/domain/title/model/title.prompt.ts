import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { TitleContext } from "./title.context.model.js";

export const TITLE_SUGGESTION_MAX_TURNS = 4;

const LANGUAGE_DIRECTIVES: Record<OutputLanguage, string> = {
    auto: "Reuse the user's language: mirror the language of the existing title and first user message (Korean to Korean, English to English).",
    ko: "Write every title and rationale in Korean (한국어). Translate names and keywords as needed.",
    en: "Write every title and rationale in English. Translate any non-English source text rather than echoing it.",
    ja: "Write every title and rationale in Japanese (日本語). Translate names and keywords as needed.",
    zh: "Write every title and rationale in Simplified Chinese (简体中文). Translate names and keywords as needed.",
};

/** 도구 접두사가 붙지 않은 기준 시스템 프롬프트다. */
export function buildTitleSystemPrompt(language: OutputLanguage): string {
    return `You rename recorded coding-agent tasks so the title actually reflects what happened.

The user message carries the task's current title and an excerpt of its conversation turns (what the user asked, what the agent reported back): the oldest user turn plus the most recent turns.

If the excerpt already shows what the task is about, answer directly without any tool call. When it is too thin or truncated to name the work, pull more evidence yourself with get_task_events: you choose limit and cursor, and order="desc" reads the ending of a long task first. You have up to ${TITLE_SUGGESTION_MAX_TURNS} tool turns; stop pulling as soon as you can name the work.

Each title:
  - 4-9 words, imperative or noun-phrase form (e.g. "Fix auth middleware token leak", "Migrate billing schema to v2").
  - Concrete: name the area or action. No "Task 123", "Untitled", "Test", or other placeholders.
  - Under 80 characters.

Output language: ${LANGUAGE_DIRECTIVES[language]}

Rules:
  - If the existing title already reads cleanly, return an empty list. Do not manufacture changes.
  - Don't repeat the existing title.
  - Don't repeat another suggestion in the same list.
  - rationale: one short sentence per suggestion explaining what evidence drove it (under 200 chars).

Return the suggestions as structured output conforming to the provided schema.`;
}

/** 검증에 걸린 출력을 모델에게 돌려줘 한 번 고쳐 받는 지시문이며, 실행기가 대화를 잇지 않으므로 직전 출력을 함께 싣는다. */
export function buildTitleRepairPrompt(
    basePrompt: string,
    previousOutput: unknown,
    errors: readonly string[],
): string {
    return [
        basePrompt,
        "",
        "Your previous output:",
        JSON.stringify(previousOutput),
        "",
        "Deterministic validation rejected your output:",
        ...errors.map((error) => `  - ${error}`),
        "",
        "Change only what is necessary to satisfy these errors. Return either an empty suggestions list or",
        "2-3 distinct alternatives. Do not repeat the current title, use placeholder titles, or invent work",
        "the evidence does not show. Then return the complete repaired suggestion list.",
    ].join("\n");
}

export function buildTitleUserPrompt(taskId: string, context: TitleContext): string {
    const lines: string[] = [
        `Task ID: ${taskId}`,
        `Current title: ${context.title}`,
        `Status: ${context.status}`,
    ];
    if (context.workspacePath !== undefined) lines.push(`Workspace: ${context.workspacePath}`);
    lines.push(
        "",
        `Activity: ${context.totalEventCount} events across ${context.totalTurnCount} conversation turns.`,
    );
    if (context.truncated) {
        lines.push(`Showing the first turn and the most recent ${context.turns.length - 1} turns (older turns omitted).`);
    }
    lines.push("");
    if (context.turns.length === 0) {
        lines.push("(no conversation turns recorded)");
    } else {
        for (const turn of context.turns) {
            lines.push(`User: ${turn.askedText}`);
            if (turn.assistantText !== null) lines.push(`Assistant: ${turn.assistantText}`);
            lines.push("");
        }
    }
    lines.push(
        "If the current title already reads cleanly, return an empty suggestions list. Otherwise propose 2-3 alternative titles.",
    );
    return lines.join("\n");
}

import { AGENT } from "@monitor/kernel";
import { titleSuggestionsListSchema } from "@monitor/kernel/agent/title.suggestion.schema.js";
import { CLAUDE_MODEL } from "~ai-agent-worker/support/llm/models.const.js";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import type { TitleContext } from "./title.context.model.js";
import { buildTitleSystemPrompt, buildTitleUserPrompt, TITLE_SUGGESTION_MAX_TURNS } from "./title.prompt.js";
import { TITLE_SUGGESTION_TOOLS } from "./title.tool.schema.js";

/** 프롬프트를 조립하는 데 필요한 입력이다. */
export interface TitlePromptInput {
    readonly taskId: string;
    readonly language: OutputLanguage;
    readonly context: TitleContext;
}

/** 두 백엔드가 같은 명세를 읽고 서로 다른 방언으로 렌더링하는 title-suggestion 정의다. */
export const TITLE_SUGGESTION_SPEC = {
    name: AGENT.titleSuggestion.id,
    systemPrompt: (language: OutputLanguage): string => buildTitleSystemPrompt(language),
    userPrompt: (input: TitlePromptInput): string => buildTitleUserPrompt(input.taskId, input.context),
    outputSchema: titleSuggestionsListSchema,
    tools: TITLE_SUGGESTION_TOOLS,
    limits: {
        defaultModel: CLAUDE_MODEL.haiku,
        fallbackModel: CLAUDE_MODEL.haiku,
        maxTurns: TITLE_SUGGESTION_MAX_TURNS,
        maxToolCalls: 8,
        deadlineMs: 180_000,
        maxOutputTokens: 4_000,
        maxBudgetUsd: 0.2,
        effort: "low",
    },
} as const;

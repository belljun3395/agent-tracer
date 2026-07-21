import { AGENT } from "@monitor/kernel";
import { cleanupSuggestionsListSchema } from "@monitor/kernel/agent/task.cleanup.schema.js";
import { CLAUDE_MODEL } from "~ai-agent-worker/support/llm/models.const.js";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import { buildCleanupSystemPrompt, buildCleanupUserPrompt, TASK_CLEANUP_MAX_TURNS } from "./cleanup.prompt.js";
import { TASK_CLEANUP_TOOLS } from "./cleanup.tool.schema.js";

/** 프롬프트를 조립하는 데 필요한 입력이다. */
export interface CleanupPromptInput {
    readonly maxSuggestions: number;
    readonly scannedAt: string;
}

/** 두 백엔드가 같은 명세를 읽고 서로 다른 방언으로 렌더링하는 task-cleanup 정의다. */
export const TASK_CLEANUP_SPEC = {
    name: AGENT.taskCleanup.id,
    systemPrompt: (language: OutputLanguage): string => buildCleanupSystemPrompt(language),
    userPrompt: (input: CleanupPromptInput): string =>
        buildCleanupUserPrompt(input.maxSuggestions, input.scannedAt),
    outputSchema: cleanupSuggestionsListSchema,
    tools: TASK_CLEANUP_TOOLS,
    limits: {
        defaultModel: CLAUDE_MODEL.haiku,
        fallbackModel: CLAUDE_MODEL.haiku,
        maxTurns: TASK_CLEANUP_MAX_TURNS,
        maxToolCalls: 48,
        deadlineMs: 300_000,
        maxOutputTokens: 16_000,
        maxBudgetUsd: 0.5,
        effort: "medium",
    },
} as const;

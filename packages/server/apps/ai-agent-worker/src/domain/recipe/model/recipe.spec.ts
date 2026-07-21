import { AGENT } from "@monitor/kernel";
import { recipeCandidatesListSchema } from "@monitor/kernel/agent/recipe.scan.schema.js";
import { CLAUDE_MODEL } from "@monitor/llm-runtime";
import type { OutputLanguage } from "~ai-agent-worker/support/output.language.js";
import { buildRecipeSystemPrompt, buildRecipeUserPrompt, RECIPE_SCAN_MAX_TURNS } from "./recipe.prompt.js";
import { RECIPE_SCAN_TOOLS } from "./recipe.tool.schema.js";

/** 프롬프트를 조립하는 데 필요한 입력이다. */
export interface RecipePromptInput {
    readonly taskId: string;
    readonly userPrompt?: string;
    readonly language: OutputLanguage;
}

/** 두 백엔드가 같은 명세를 읽고 서로 다른 방언으로 렌더링하는 recipe-scan 정의다. */
export const RECIPE_SCAN_SPEC = {
    name: AGENT.recipeScan.id,
    systemPrompt: (): string => buildRecipeSystemPrompt(),
    userPrompt: (input: RecipePromptInput): string =>
        buildRecipeUserPrompt(input.taskId, input.userPrompt, input.language),
    outputSchema: recipeCandidatesListSchema,
    tools: RECIPE_SCAN_TOOLS,
    limits: {
        defaultModel: CLAUDE_MODEL.sonnet,
        fallbackModel: CLAUDE_MODEL.haiku,
        maxTurns: RECIPE_SCAN_MAX_TURNS,
        deadlineMs: 720_000,
        maxOutputTokens: 16_000,
        maxBudgetUsd: 2,
        effort: "medium",
    },
} as const;

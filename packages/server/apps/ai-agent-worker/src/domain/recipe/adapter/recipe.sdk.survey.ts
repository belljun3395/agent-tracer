import type { AgentBudgetLease } from "~ai-agent-worker/support/llm/agent.budget.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { StructuredQueryResult } from "~ai-agent-worker/config/llm/structured.query.js";
import { buildRecipeSurveyPrompt, buildRecipeSurveySystemPrompt } from "~ai-agent-worker/domain/recipe/model/recipe.prompt.js";
import { dispatchPlanSchema, type DispatchPlan } from "~ai-agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import { RECIPE_SCAN_SPEC } from "~ai-agent-worker/domain/recipe/model/recipe.spec.js";
import { runRecipeQuery, type RecipeQueryContext } from "./recipe.sdk.query.js";

/** 조율자가 도구 없이 이번 조사를 어디에 얼마나 배분할지 스스로 정하게 한다. */
export function runRecipeSurvey(
    ctx: RecipeQueryContext,
    availableTurns: number,
    lease: AgentBudgetLease,
): Promise<StructuredQueryResult<DispatchPlan>> {
    return runRecipeQuery(ctx, {
        label: `${RECIPE_SCAN_SPEC.name}:survey`,
        prompt: buildRecipeSurveyPrompt(ctx.input.taskId, ctx.input.userPrompt, availableTurns),
        systemPrompt: buildRecipeSurveySystemPrompt(),
        toolNames: [],
        toolSpecs: [],
        handlers: {},
        outputSchema: dispatchPlanSchema,
        claudeOutputSchema: zodToClaudeOutputSchema(dispatchPlanSchema),
        lease,
    });
}

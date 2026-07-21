import type { AiJobStepPayload } from "@monitor/kernel";
import { AgentExecutionFailure } from "~ai-agent-worker/support/llm/agent.error.js";
import type { AgentBudgetLease } from "~ai-agent-worker/support/llm/agent.budget.js";
import { zodToClaudeOutputSchema } from "~ai-agent-worker/config/llm/claude.output.schema.js";
import type { AgentCallAccounting } from "~ai-agent-worker/support/llm/agent.accounting.js";
import { buildRecipeProbePrompt, buildRecipeProbeSystemPrompt } from "~ai-agent-worker/domain/recipe/model/recipe.prompt.js";
import { probeReportSchema, type ProbeAssignment, type ProbeReport } from "~ai-agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import { buildProbeFailureReport, probeToolNames, probeToolSpecs } from "~ai-agent-worker/domain/recipe/model/recipe.dispatch.policy.js";
import { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { RECIPE_SCAN_SPEC } from "~ai-agent-worker/domain/recipe/model/recipe.spec.js";
import { buildRecipeToolHandlers, type RecipeToolDeps } from "./recipe.tools.js";
import { runRecipeQuery, type RecipeQueryContext } from "./recipe.sdk.query.js";

/** 전문가 한 명이 자기 도구·자기 장부·자기 예산으로 조사한 결과다. */
export interface RecipeProbeRun {
    readonly report: ProbeReport;
    readonly ledger: ProvenanceLedger;
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly AiJobStepPayload[];
}

/** 맡은 질문 하나를 자기 도구와 자기 장부로 조사하는 전문가를 실행하며, 무너져도 예외 대신 실패 보고로 강등해 다른 전문가의 성과를 지킨다. */
export async function runRecipeProbe(
    ctx: RecipeQueryContext,
    deps: RecipeToolDeps,
    assignment: ProbeAssignment,
    lease: AgentBudgetLease,
): Promise<RecipeProbeRun> {
    const ledger = new ProvenanceLedger();
    const handlers = buildRecipeToolHandlers(ctx.input.userId, deps, ledger);
    const toolNames = probeToolNames(assignment.probe);

    try {
        const run = await runRecipeQuery(ctx, {
            label: `${RECIPE_SCAN_SPEC.name}:probe:${assignment.probe}`,
            prompt: buildRecipeProbePrompt(ctx.input.taskId, assignment.question, lease.maxTurns),
            systemPrompt: buildRecipeProbeSystemPrompt(),
            toolNames,
            toolSpecs: probeToolSpecs(assignment.probe),
            handlers,
            outputSchema: probeReportSchema,
            claudeOutputSchema: zodToClaudeOutputSchema(probeReportSchema),
            lease,
        });
        return {
            report: run.data,
            ledger,
            accounting: { durationMs: run.durationMs, costUsd: run.costUsd, numTurns: run.numTurns, usage: run.usage },
            steps: run.steps,
        };
    } catch (error) {
        return {
            report: buildProbeFailureReport(assignment.probe, error),
            ledger,
            accounting: agentFailureAccounting(error),
            steps: error instanceof AgentExecutionFailure ? error.steps : [],
        };
    }
}

// 무너진 호출의 실제 지출은 알 수 없으므로, 예약해 준 몫을 나중에 settle()의 null 처리가
// 전부 쓴 것으로 보수적으로 간주하게 costUsd와 numTurns를 비워 둔다.
export function agentFailureAccounting(error: unknown): AgentCallAccounting {
    return {
        durationMs: error instanceof AgentExecutionFailure ? (error.durationMs ?? 0) : 0,
        costUsd: null,
        numTurns: null,
        usage: error instanceof AgentExecutionFailure ? error.usage : null,
    };
}

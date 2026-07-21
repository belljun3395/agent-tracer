import { AGENT, JOB_KIND, type AiJobStepPayload, type RecipeCandidatePayload } from "@monitor/kernel";
import {
    AGENT_BACKEND,
    isBudgetExhaustedFailure,
    mergeAgentTrajectory,
    type ClaudeQueryOptions,
    type IQueryRunner,
    type StructuredQueryResult,
    withInvokeAgentTelemetry,
} from "@monitor/llm-runtime";
import { combineLeases, ExecutionBudget, type AgentBudgetLease } from "~ai-agent-worker/support/llm/agent.budget.js";
import { mergeAgentCallAccounting, type AgentCallAccounting } from "~ai-agent-worker/support/llm/agent.accounting.js";
import { buildRecipeRepairPrompt, buildRecipeUserPrompt } from "~ai-agent-worker/domain/recipe/model/recipe.prompt.js";
import { RECIPE_SCAN_SPEC } from "~ai-agent-worker/domain/recipe/model/recipe.spec.js";
import { type DispatchPlan, type ProbeReport } from "~ai-agent-worker/domain/recipe/model/recipe.dispatch.schema.js";
import {
    MIN_SYNTHESIS_TURNS,
    REPAIR_RESERVED_BUDGET_SHARE,
    REPAIR_RESERVED_TURNS,
    SURVEY_BUDGET_SHARE,
    SURVEY_TURNS,
} from "~ai-agent-worker/domain/recipe/model/recipe.dispatch.policy.js";
import { ProvenanceLedger } from "~ai-agent-worker/domain/recipe/model/recipe.provenance.model.js";
import { validateRecipeCandidates } from "~ai-agent-worker/domain/recipe/model/recipe.validation.model.js";
import type {
    GenerateRecipeCandidatesInput,
    GenerateRecipeCandidatesOutput,
    RecipeAgentPort,
} from "~ai-agent-worker/domain/recipe/port/recipe.agent.port.js";
import type { RecipeToolDeps } from "./recipe.tools.js";
import type { RecipeQueryContext } from "./recipe.sdk.query.js";
import { runRecipeSurvey } from "./recipe.sdk.survey.js";
import { agentFailureAccounting, runRecipeProbe } from "./recipe.sdk.probe.js";
import { runRecipeSynthesis, type RecipeSynthesisRun } from "./recipe.sdk.investigate.js";

export {
    RECIPE_COORDINATOR_TOOLS,
    RECIPE_WORKER_MAX_TURNS,
    RECIPE_PROBE_TOOL_NAMES as RECIPE_WORKER_TOOLS,
} from "~ai-agent-worker/domain/recipe/model/recipe.dispatch.policy.js";

type AnyStructuredQueryResult = StructuredQueryResult<unknown>;

// 조율자가 조사 규모를 가늠하도록, 계약 총량에서 수리와 계획 몫을 뺀 값을 미리 알려 준다.
const SURVEY_AVAILABLE_TURNS = RECIPE_SCAN_SPEC.limits.maxTurns - REPAIR_RESERVED_TURNS - SURVEY_TURNS;

const EMPTY_PLAN: DispatchPlan = { probes: [] };

interface RunSegment {
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly AiJobStepPayload[];
    readonly nodeName: string;
}

/** Claude Agent SDK 방언으로 recipe 명세를 렌더링해, 계획 → 팬아웃 → 종합 → 검증 → 수리로 실행한다. */
export class RecipeSdkAgentAdapter implements RecipeAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly deps: RecipeToolDeps,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async generate(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.recipeScan,
                agentName: AGENT.recipeScan.id,
                backend: AGENT_BACKEND.claudeSdk,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateRecipeCandidatesInput): Promise<GenerateRecipeCandidatesOutput> {
        const ctx: RecipeQueryContext = { runner: this.runner, input };
        const { limits } = RECIPE_SCAN_SPEC;
        const budget = new ExecutionBudget({ maxBudgetUsd: limits.maxBudgetUsd, maxTurns: limits.maxTurns });

        // 수리와 계획과 종합 바닥을 먼저 떼어 두어, 전문가 배분이 그 몫을 침범하지 못하게 한다.
        const repairLease = budget.reserve(REPAIR_RESERVED_TURNS, REPAIR_RESERVED_BUDGET_SHARE);
        const surveyLease = budget.reserve(SURVEY_TURNS, SURVEY_BUDGET_SHARE);
        const synthesisFloorLease = budget.reserve(MIN_SYNTHESIS_TURNS, 0);

        const segments: RunSegment[] = [];
        const plan = await this.survey(ctx, surveyLease, segments);

        const coordinatorLedger = new ProvenanceLedger();
        const reports = plan.probes.length === 0 ? [] : await this.dispatch(ctx, budget, plan, coordinatorLedger, segments);

        const synthesisLease = combineLeases([synthesisFloorLease, budget.lease(1)]);
        const investigatePrompt = buildRecipeUserPrompt(
            input.taskId,
            input.userPrompt,
            input.language,
            plan.probes.length === 0 ? null : plan,
            reports,
        );
        const synthesis = await runRecipeSynthesis(
            ctx,
            this.deps,
            coordinatorLedger,
            investigatePrompt,
            synthesisLease,
            "investigate",
        );
        budget.settle(synthesisLease, { costUsd: synthesis.costUsd, numTurns: synthesis.numTurns });
        segments.push(toSegment(synthesis, "investigate"));

        const errors = validateRecipeCandidates(synthesis.data.recipes, input.taskId, coordinatorLedger.snapshot());
        if (errors.length === 0) return toOutput(segments, synthesis.data.recipes, synthesis.modelUsed, coordinatorLedger);

        // 예약된 몫마저 바닥나 수리를 시도할 수 없으면 오류가 아닌 빈 결과로 착지한다.
        if (repairLease.maxTurns <= 0) return toOutput(segments, [], synthesis.modelUsed, coordinatorLedger);

        let repaired: RecipeSynthesisRun;
        try {
            repaired = await runRecipeSynthesis(
                ctx,
                this.deps,
                coordinatorLedger,
                buildRecipeRepairPrompt(investigatePrompt, synthesis.data, errors),
                repairLease,
                "repair",
            );
        } catch (error) {
            // 예약해 둔 몫으로도 모델이 예산을 다 써버렸으면 잡을 실패시키지 않고 빈 결과로 착지한다.
            if (isBudgetExhaustedFailure(error)) return toOutput(segments, [], synthesis.modelUsed, coordinatorLedger);
            throw error;
        }
        budget.settle(repairLease, { costUsd: repaired.costUsd, numTurns: repaired.numTurns });
        segments.push(toSegment(repaired, "repair"));

        const remaining = validateRecipeCandidates(repaired.data.recipes, input.taskId, coordinatorLedger.snapshot());
        return toOutput(segments, remaining.length === 0 ? repaired.data.recipes : [], repaired.modelUsed, coordinatorLedger);
    }

    /** 조율자가 도구 없이 조사 계획을 세우며, 계획이 비거나 호출이 무너지면 혼자 조사하는 빈 계획으로 대체한다. */
    private async survey(
        ctx: RecipeQueryContext,
        lease: AgentBudgetLease,
        segments: RunSegment[],
    ): Promise<DispatchPlan> {
        if (lease.maxTurns <= 0) return EMPTY_PLAN;
        try {
            const run = await runRecipeSurvey(ctx, SURVEY_AVAILABLE_TURNS, lease);
            segments.push(toSegment(run, "survey"));
            return run.data;
        } catch (error) {
            segments.push({
                accounting: agentFailureAccounting(error),
                steps: [],
                nodeName: "survey",
            });
            return EMPTY_PLAN;
        }
    }

    /** 계획대로 전문가를 병렬로 띄우고, 보고가 모이면 장부를 조율자 장부로 합친다. */
    private async dispatch(
        ctx: RecipeQueryContext,
        budget: ExecutionBudget,
        plan: DispatchPlan,
        coordinatorLedger: ProvenanceLedger,
        segments: RunSegment[],
    ): Promise<ProbeReport[]> {
        const probeLeases = budget.leaseMany(
            plan.probes.map((assignment) => assignment.weight),
            1,
        );
        const probeRuns = await Promise.all(
            plan.probes.map((assignment, index) => runRecipeProbe(ctx, this.deps, assignment, probeLeases[index]!)),
        );

        const reports: ProbeReport[] = [];
        probeRuns.forEach((run, index) => {
            budget.settle(probeLeases[index]!, { costUsd: run.accounting.costUsd, numTurns: run.accounting.numTurns });
            coordinatorLedger.mergeFrom(run.ledger);
            reports.push(run.report);
            segments.push({ accounting: run.accounting, steps: run.steps, nodeName: `probe:${run.report.probe}` });
        });
        return reports;
    }
}

function toSegment(run: AnyStructuredQueryResult, nodeName: string): RunSegment {
    return {
        accounting: { durationMs: run.durationMs, costUsd: run.costUsd, numTurns: run.numTurns, usage: run.usage },
        steps: run.steps,
        nodeName,
    };
}

function toOutput(
    segments: readonly RunSegment[],
    recipes: readonly RecipeCandidatePayload[],
    modelUsed: string,
    ledger: ProvenanceLedger,
): GenerateRecipeCandidatesOutput {
    const accounting = mergeAgentCallAccounting(segments.map((segment) => segment.accounting));
    return {
        recipes,
        modelUsed,
        durationMs: accounting.durationMs,
        costUsd: accounting.costUsd,
        numTurns: accounting.numTurns,
        usage: accounting.usage,
        steps: mergeAgentTrajectory(segments.map((segment) => ({ nodeName: segment.nodeName, steps: segment.steps }))),
        provenance: ledger.snapshot(),
    };
}

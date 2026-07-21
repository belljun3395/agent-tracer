import { AGENT, JOB_KIND, type AiJobStepPayload, type CleanupSuggestionPayload } from "@monitor/kernel";
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
import { buildCleanupRepairPrompt, buildCleanupUserPrompt } from "~ai-agent-worker/domain/cleanup/model/cleanup.prompt.js";
import { TASK_CLEANUP_SPEC } from "~ai-agent-worker/domain/cleanup/model/cleanup.spec.js";
import { type InspectReport, type TriagePlan } from "~ai-agent-worker/domain/cleanup/model/cleanup.dispatch.schema.js";
import {
    MIN_DECISION_TURNS,
    REPAIR_RESERVED_BUDGET_SHARE,
    REPAIR_RESERVED_TURNS,
    TRIAGE_BUDGET_SHARE,
    TRIAGE_TURNS,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";
import { CleanupProvenanceLedger } from "~ai-agent-worker/domain/cleanup/model/cleanup.provenance.model.js";
import { validateCleanupSuggestions } from "~ai-agent-worker/domain/cleanup/model/cleanup.validation.model.js";
import type {
    CleanupAgentPort,
    GenerateCleanupSuggestionsInput,
    GenerateCleanupSuggestionsOutput,
} from "~ai-agent-worker/domain/cleanup/port/cleanup.agent.port.js";
import { type CleanupToolBatch, type CleanupToolDeps } from "./cleanup.tools.js";
import type { CleanupQueryContext } from "./cleanup.sdk.query.js";
import { runCleanupTriage } from "./cleanup.sdk.triage.js";
import { agentFailureAccounting, runCleanupInspect } from "./cleanup.sdk.inspect.js";
import { runCleanupDecision, type CleanupDecisionRun } from "./cleanup.sdk.investigate.js";

export {
    CLEANUP_COORDINATOR_TOOLS,
    CLEANUP_REVIEWER_MAX_TURNS,
    CLEANUP_REVIEWER_ROLE,
    CLEANUP_REVIEWER_TOOLS,
} from "~ai-agent-worker/domain/cleanup/model/cleanup.dispatch.policy.js";

// 조율자가 조사 규모를 가늠하도록, 계약 총량에서 수리와 선별 몫을 뺀 값을 미리 알려 준다.
const TRIAGE_AVAILABLE_TURNS = TASK_CLEANUP_SPEC.limits.maxTurns - REPAIR_RESERVED_TURNS - TRIAGE_TURNS;

const EMPTY_PLAN: TriagePlan = { inspect: [] };

type AnyStructuredQueryResult = StructuredQueryResult<unknown>;

interface RunSegment {
    readonly accounting: AgentCallAccounting;
    readonly steps: readonly AiJobStepPayload[];
    readonly nodeName: string;
}

/** Claude Agent SDK 방언으로 cleanup 명세를 렌더링해, 선별 → 후보별 조사 팬아웃 → 결정 → 검증 → 수리로 실행한다. */
export class CleanupSdkAgentAdapter implements CleanupAgentPort {
    constructor(
        private readonly runner: IQueryRunner<ClaudeQueryOptions>,
        private readonly deps: CleanupToolDeps,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.runner.requiresLocalApiKey();
    }

    async generate(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        return withInvokeAgentTelemetry(
            {
                jobId: input.jobId,
                jobKind: JOB_KIND.taskCleanup,
                agentName: AGENT.taskCleanup.id,
                backend: AGENT_BACKEND.claudeSdk,
                ...(input.model !== undefined ? { model: input.model } : {}),
            },
            () => this.runAgent(input),
        );
    }

    private async runAgent(input: GenerateCleanupSuggestionsInput): Promise<GenerateCleanupSuggestionsOutput> {
        const ctx: CleanupQueryContext = { runner: this.runner, input };
        const batch: CleanupToolBatch = { candidates: input.candidates, batchTruncated: input.truncated };
        const { limits } = TASK_CLEANUP_SPEC;
        const budget = new ExecutionBudget({ maxBudgetUsd: limits.maxBudgetUsd, maxTurns: limits.maxTurns });

        // 수리와 선별과 결정 바닥을 먼저 떼어 두어, 후보별 배분이 그 몫을 침범하지 못하게 한다.
        const repairLease = budget.reserve(REPAIR_RESERVED_TURNS, REPAIR_RESERVED_BUDGET_SHARE);
        const triageLease = budget.reserve(TRIAGE_TURNS, TRIAGE_BUDGET_SHARE);
        const decisionFloorLease = budget.reserve(MIN_DECISION_TURNS, 0);

        const segments: RunSegment[] = [];
        const { plan, ledger: triageLedger } = await this.triage(ctx, batch, triageLease, segments);

        const coordinatorLedger = new CleanupProvenanceLedger();
        coordinatorLedger.mergeFrom(triageLedger);
        const reports =
            plan.inspect.length === 0 ? [] : await this.dispatch(ctx, batch, budget, plan, coordinatorLedger, segments);

        const decisionLease = combineLeases([decisionFloorLease, budget.lease(1)]);
        const decisionPrompt = buildCleanupUserPrompt(input.maxSuggestions, input.scannedAt, reports);
        const decision = await runCleanupDecision(
            ctx,
            this.deps,
            batch,
            coordinatorLedger,
            input.language,
            decisionPrompt,
            decisionLease,
            "investigate",
        );
        budget.settle(decisionLease, { costUsd: decision.costUsd, numTurns: decision.numTurns });
        segments.push(toSegment(decision, "investigate"));

        const checked = validateCleanupSuggestions(decision.data.suggestions, coordinatorLedger.snapshot(), input.maxSuggestions);
        if (checked.errors.length === 0) return toOutput(segments, checked.valid, decision.modelUsed);

        // 예약된 몫마저 바닥나 수리를 시도할 수 없으면 오류가 아닌 빈 결과로 착지한다.
        if (repairLease.maxTurns <= 0) return toOutput(segments, [], decision.modelUsed);

        let repaired: CleanupDecisionRun;
        try {
            repaired = await runCleanupDecision(
                ctx,
                this.deps,
                batch,
                coordinatorLedger,
                input.language,
                buildCleanupRepairPrompt(decisionPrompt, decision.data, checked.errors),
                repairLease,
                "repair",
            );
        } catch (error) {
            // 예약해 둔 몫으로도 모델이 예산을 다 써버렸으면 잡을 실패시키지 않고 빈 결과로 착지한다.
            if (isBudgetExhaustedFailure(error)) return toOutput(segments, [], decision.modelUsed);
            throw error;
        }
        budget.settle(repairLease, { costUsd: repaired.costUsd, numTurns: repaired.numTurns });
        segments.push(toSegment(repaired, "repair"));

        const rechecked = validateCleanupSuggestions(repaired.data.suggestions, coordinatorLedger.snapshot(), input.maxSuggestions);
        return toOutput(segments, rechecked.valid, repaired.modelUsed);
    }

    /** 조율자가 목록 도구만 쥐고 무엇을 열어볼지 선별하며, 계획이 비거나 호출이 무너지면 혼자 조사하는 빈 계획으로 대체한다. */
    private async triage(
        ctx: CleanupQueryContext,
        batch: CleanupToolBatch,
        lease: AgentBudgetLease,
        segments: RunSegment[],
    ): Promise<{ readonly plan: TriagePlan; readonly ledger: CleanupProvenanceLedger }> {
        if (lease.maxTurns <= 0) return { plan: EMPTY_PLAN, ledger: new CleanupProvenanceLedger() };
        try {
            const { result, ledger } = await runCleanupTriage(ctx, this.deps, batch, TRIAGE_AVAILABLE_TURNS, lease);
            segments.push(toSegment(result, "triage"));
            return { plan: result.data, ledger };
        } catch (error) {
            segments.push({ accounting: agentFailureAccounting(error), steps: [], nodeName: "triage" });
            return { plan: EMPTY_PLAN, ledger: new CleanupProvenanceLedger() };
        }
    }

    /** 계획대로 후보를 병렬로 열어보고, 보고가 모이면 장부를 조율자 장부로 합친다. */
    private async dispatch(
        ctx: CleanupQueryContext,
        batch: CleanupToolBatch,
        budget: ExecutionBudget,
        plan: TriagePlan,
        coordinatorLedger: CleanupProvenanceLedger,
        segments: RunSegment[],
    ): Promise<InspectReport[]> {
        const leases = budget.leaseMany(
            plan.inspect.map((assignment) => assignment.weight),
            1,
        );
        const runs = await Promise.all(
            plan.inspect.map((assignment, index) => runCleanupInspect(ctx, this.deps, batch, assignment, leases[index]!)),
        );

        const reports: InspectReport[] = [];
        runs.forEach((run, index) => {
            budget.settle(leases[index]!, { costUsd: run.accounting.costUsd, numTurns: run.accounting.numTurns });
            coordinatorLedger.mergeFrom(run.ledger);
            reports.push(run.report);
            segments.push({ accounting: run.accounting, steps: run.steps, nodeName: `inspect:${run.report.taskId}` });
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
    suggestions: readonly CleanupSuggestionPayload[],
    modelUsed: string,
): GenerateCleanupSuggestionsOutput {
    const accounting = mergeAgentCallAccounting(segments.map((segment) => segment.accounting));
    return {
        suggestions,
        modelUsed,
        durationMs: accounting.durationMs,
        costUsd: accounting.costUsd,
        numTurns: accounting.numTurns,
        usage: accounting.usage,
        steps: mergeAgentTrajectory(segments.map((segment) => ({ nodeName: segment.nodeName, steps: segment.steps }))),
    };
}

import {createDeadline, isRulegenCanceled} from "~runtime/domain/rulegen/model/deadline.model.js";
import {groundRuleProposals} from "~runtime/domain/rulegen/model/proposal.grounding.model.js";
import {validateRuleProposals} from "~runtime/domain/rulegen/model/proposal.validation.model.js";
import type {RuleProposalPayload} from "@monitor/kernel/rule/proposal/rule.proposal.schema.js";
import {
    mergeRuleGenerationOutcomes,
    ruleGenerationFailure,
    type RuleGenerationFailure,
    type RuleGenerationOutcome,
    type RuleGenerationReport,
} from "~runtime/domain/rulegen/model/rule.job.model.js";
import {ruleGenLogLine} from "~runtime/domain/rulegen/model/rulegen.log.model.js";
import {buildRulegenRepairPrompt} from "~runtime/domain/rulegen/model/rulegen.prompt.model.js";
import {RulegenProvenanceLedger} from "~runtime/domain/rulegen/model/rulegen.provenance.model.js";
import {
    buildRuleGenerationSpec,
    type RuleGenerationRequest,
    type RuleGenerationSpec,
} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import {
    resolveEventLimit,
    rulegenToolFailureText,
    rulegenToolSpec,
    RULEGEN_TOOL,
    type RulegenToolName,
    type RulegenToolset,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
import type {ClockPort} from "~runtime/domain/rulegen/port/clock.port.js";
import {RuleEvidenceHttpError, type RuleEvidencePort} from "~runtime/domain/rulegen/port/rule.evidence.port.js";
import type {RuleGeneratorPort} from "~runtime/domain/rulegen/port/rule.generator.port.js";
import type {RuleJobPort} from "~runtime/domain/rulegen/port/rule.job.port.js";

const RESULT_REPORT_FAILED = "result report failed";

interface ScreenedProposals {
    readonly proposals: readonly RuleProposalPayload[];
    readonly errors: readonly string[];
}

/** 클레임한 잡 하나를 도구 루프 실행부터 결과 보고까지 끝낸다. */
export class RunRuleJobUsecase {
    constructor(
        private readonly evidence: RuleEvidencePort,
        private readonly generator: RuleGeneratorPort,
        private readonly jobs: RuleJobPort,
        private readonly clock: ClockPort,
    ) {}

    async execute(request: RuleGenerationRequest, cancelSignal?: AbortSignal): Promise<void> {
        const spec = buildRuleGenerationSpec(request);
        const deadline = createDeadline(spec.deadlineMs, cancelSignal);
        const signal = deadline.controller.signal;
        const startedAt = this.clock.now();
        const ledger = new RulegenProvenanceLedger();
        try {
            const toolset = this.toolset(signal, ledger);
            const first = await this.generator.generate(spec, toolset, signal);
            // 취소됐거나 리스를 잃은 잡은 더 이상 이 데몬의 것이 아니므로 실패로 종결하지 않는다.
            if (isRulegenCanceled(signal.reason)) return;
            if (first.error !== null) {
                await this.jobs.fail(request.jobId, this.failure(spec, startedAt, first, first.error));
                return;
            }

            const screened = this.screen(first.candidates, ledger);
            const {outcome, proposals} = screened.errors.length === 0
                ? {outcome: first, proposals: screened.proposals}
                : await this.repair(spec, toolset, signal, ledger, first, screened.errors);
            if (isRulegenCanceled(signal.reason)) return;
            if (outcome.error !== null) {
                await this.jobs.fail(request.jobId, this.failure(spec, startedAt, outcome, outcome.error));
                return;
            }

            const report: RuleGenerationReport = {
                proposals: proposals.slice(0, spec.maxRules),
                modelUsed: spec.model,
                durationMs: this.clock.now() - startedAt,
                costUsd: outcome.costUsd,
                numTurns: outcome.numTurns,
                ...(outcome.usage !== null ? {usage: outcome.usage} : {}),
                steps: outcome.steps,
            };
            if (!await this.jobs.reportResult(request.jobId, report)) {
                await this.jobs.fail(request.jobId, this.failure(spec, startedAt, outcome, RESULT_REPORT_FAILED));
            }
        } catch (error) {
            if (isRulegenCanceled(signal.reason)) return;
            const message = error instanceof Error ? error.message : String(error);
            await this.jobs.fail(request.jobId, ruleGenerationFailure(message));
        } finally {
            deadline.dispose();
        }
    }

    /** 오류를 모델에게 돌려주고 한 번만 다시 받으며 그래도 근거가 서지 않는 제안은 버린다. */
    private async repair(
        spec: RuleGenerationSpec,
        toolset: RulegenToolset,
        signal: AbortSignal,
        ledger: RulegenProvenanceLedger,
        first: RuleGenerationOutcome,
        errors: readonly string[],
    ): Promise<{readonly outcome: RuleGenerationOutcome; readonly proposals: readonly RuleProposalPayload[]}> {
        const repairSpec: RuleGenerationSpec = {
            ...spec,
            userPrompt: buildRulegenRepairPrompt(spec.userPrompt, {rules: first.candidates}, errors),
        };
        const second = await this.generator.generate(repairSpec, toolset, signal);
        const outcome = mergeRuleGenerationOutcomes(first, second);
        if (isRulegenCanceled(signal.reason) || outcome.error !== null) return {outcome, proposals: []};

        const screened = this.screen(outcome.candidates, ledger);
        for (const error of screened.errors) {
            process.stderr.write(ruleGenLogLine(`dropped proposal after repair: ${error}`));
        }
        return {outcome, proposals: screened.proposals};
    }

    private screen(candidates: readonly unknown[], ledger: RulegenProvenanceLedger): ScreenedProposals {
        const {accepted, rejected} = validateRuleProposals(candidates);
        const {grounded, errors} = groundRuleProposals(accepted, ledger.snapshot());
        return {
            proposals: grounded,
            errors: [
                ...rejected.map((item) => `Rule #${item.index + 1} violates the output schema: ${item.reason}.`),
                ...errors,
            ],
        };
    }

    /** 실패한 실행도 이미 비용을 청구했으므로 그 비용과 궤적을 실패 보고에 함께 싣는다. */
    private failure(
        spec: RuleGenerationSpec,
        startedAt: number,
        outcome: RuleGenerationOutcome,
        error: string,
    ): RuleGenerationFailure {
        return {
            error,
            modelUsed: spec.model,
            durationMs: this.clock.now() - startedAt,
            costUsd: outcome.costUsd,
            numTurns: outcome.numTurns,
            ...(outcome.usage !== null ? {usage: outcome.usage} : {}),
            steps: outcome.steps,
        };
    }

    /** 장부는 도구가 모델에게 실제로 돌려준 응답만 먹어야 검증이 통과 도장이 되지 않는다. */
    private toolset(signal: AbortSignal, ledger: RulegenProvenanceLedger): RulegenToolset {
        return {
            [RULEGEN_TOOL.turns]: (input) =>
                this.answer(RULEGEN_TOOL.turns, async () => {
                    const turns = await this.evidence.fetchTurns(input.taskId, signal);
                    ledger.recordTurns(turns);
                    return turns;
                }),
            [RULEGEN_TOOL.events]: (input) =>
                this.answer(RULEGEN_TOOL.events, async () => {
                    const events = await this.evidence.fetchEvents(
                        input.taskId,
                        resolveEventLimit(input.limit),
                        signal,
                    );
                    ledger.recordEvents(events);
                    return events;
                }),
            [RULEGEN_TOOL.rules]: () =>
                this.answer(RULEGEN_TOOL.rules, () => this.evidence.fetchExistingRules(signal)),
        };
    }

    private async answer(name: RulegenToolName, fetch: () => Promise<unknown>): Promise<string> {
        try {
            return JSON.stringify(await fetch(), null, 2);
        } catch (error) {
            if (error instanceof RuleEvidenceHttpError) {
                return rulegenToolFailureText(rulegenToolSpec(name), error.status);
            }
            throw error;
        }
    }
}

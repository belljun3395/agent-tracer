import {createDeadline, isRulegenCanceled} from "~runtime/domain/rulegen/model/deadline.model.js";
import {validateRuleProposals} from "~runtime/domain/rulegen/model/proposal.validation.model.js";
import {
    ruleGenerationFailure,
    type RuleGenerationFailure,
    type RuleGenerationOutcome,
    type RuleGenerationReport,
} from "~runtime/domain/rulegen/model/rule.job.model.js";
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
        try {
            const outcome = await this.generator.generate(spec, this.toolset(signal), signal);
            // 취소됐거나 리스를 잃은 잡은 더 이상 이 데몬의 것이 아니므로 실패로 종결하지 않는다.
            if (isRulegenCanceled(signal.reason)) return;

            if (outcome.error !== null) {
                await this.jobs.fail(request.jobId, this.failure(spec, startedAt, outcome, outcome.error));
                return;
            }
            const {accepted, rejected} = validateRuleProposals(outcome.candidates);
            for (const item of rejected) {
                process.stderr.write(`[rule-gen] dropped proposal #${item.index}: ${item.reason}\n`);
            }
            const report: RuleGenerationReport = {
                proposals: accepted.slice(0, spec.maxRules),
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

    private toolset(signal: AbortSignal): RulegenToolset {
        return {
            [RULEGEN_TOOL.turns]: (input) =>
                this.answer(RULEGEN_TOOL.turns, () => this.evidence.fetchTurns(input.taskId, signal)),
            [RULEGEN_TOOL.events]: (input) =>
                this.answer(RULEGEN_TOOL.events, () =>
                    this.evidence.fetchEvents(input.taskId, resolveEventLimit(input.limit), signal)),
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

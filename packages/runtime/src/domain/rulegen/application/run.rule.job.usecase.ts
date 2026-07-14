import {createDeadline, DEFAULT_RULEGEN_DEADLINE_MS} from "~runtime/domain/rulegen/model/deadline.model.js";
import {validateRuleProposals} from "~runtime/domain/rulegen/model/proposal.validation.model.js";
import type {RuleGenerationReport} from "~runtime/domain/rulegen/model/rule.job.model.js";
import {
    buildRuleGenerationSpec,
    type RuleGenerationRequest,
} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import {
    resolveEventLimit,
    rulegenToolFailureText,
    rulegenToolSpec,
    RULEGEN_TOOL,
    type RulegenToolName,
    type RulegenToolset,
} from "~runtime/domain/rulegen/model/rulegen.tool.model.js";
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
    ) {}

    async execute(request: RuleGenerationRequest, cancelSignal?: AbortSignal): Promise<void> {
        const deadline = createDeadline(DEFAULT_RULEGEN_DEADLINE_MS, cancelSignal);
        const signal = deadline.controller.signal;
        const startedAt = Date.now();
        try {
            const spec = buildRuleGenerationSpec(request);
            const outcome = await this.generator.generate(spec, this.toolset(signal), signal);
            if (outcome.error !== null) {
                await this.jobs.fail(request.jobId, outcome.error);
                return;
            }
            const {accepted, rejected} = validateRuleProposals(outcome.candidates);
            for (const item of rejected) {
                process.stderr.write(`[rule-gen] dropped proposal #${item.index}: ${item.reason}\n`);
            }
            const report: RuleGenerationReport = {
                proposals: accepted.slice(0, spec.maxRules),
                modelUsed: spec.model,
                durationMs: Date.now() - startedAt,
                costUsd: outcome.costUsd,
                numTurns: outcome.numTurns,
                ...(outcome.usage !== null ? {usage: outcome.usage} : {}),
            };
            if (!await this.jobs.reportResult(request.jobId, report)) {
                await this.jobs.fail(request.jobId, RESULT_REPORT_FAILED);
            }
        } catch (error) {
            if (signal.aborted) return;
            await this.jobs.fail(request.jobId, error instanceof Error ? error.message : String(error));
        } finally {
            deadline.dispose();
        }
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

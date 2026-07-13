import {createDeadline, DEFAULT_RULEGEN_DEADLINE_MS} from "~runtime/domain/rulegen/model/deadline.model.js";
import {selectEvidence, type RuleGenerationEvidence} from "~runtime/domain/rulegen/model/evidence.model.js";
import {validateRuleProposals} from "~runtime/domain/rulegen/model/proposal.validation.model.js";
import type {RuleGenerationReport} from "~runtime/domain/rulegen/model/rule.job.model.js";
import {resolveRulegenMode} from "~runtime/domain/rulegen/model/rulegen.mode.model.js";
import {
    buildRuleGenerationSpec,
    type RuleGenerationRequest,
} from "~runtime/domain/rulegen/model/rulegen.spec.model.js";
import type {RuleEvidencePort} from "~runtime/domain/rulegen/port/rule.evidence.port.js";
import type {RuleGeneratorPort} from "~runtime/domain/rulegen/port/rule.generator.port.js";
import type {RuleJobPort} from "~runtime/domain/rulegen/port/rule.job.port.js";

const RESULT_REPORT_FAILED = "result report failed";

/** 클레임한 잡 하나를 근거 수집부터 결과 보고까지 끝낸다. */
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
            const evidence = await this.loadEvidence(request, signal);
            const spec = buildRuleGenerationSpec(request, evidence);
            const outcome = await this.generator.generate(spec, signal);
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

    private async loadEvidence(
        request: RuleGenerationRequest,
        signal: AbortSignal,
    ): Promise<RuleGenerationEvidence> {
        const [turns, events, existingRules] = await Promise.all([
            this.evidence.fetchTurns(request.taskId, signal),
            this.evidence.fetchEvents(request.taskId, signal),
            this.evidence.fetchExistingRules(signal),
        ]);
        return selectEvidence(resolveRulegenMode(request.focus), {turns, events, existingRules});
    }
}

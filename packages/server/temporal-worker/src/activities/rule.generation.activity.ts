import { Injectable, Inject } from "@nestjs/common";
import { Context } from "@temporalio/activity";
import type {
    RuleSuggestionAgent,
    GenerateRuleSuggestionsInput,
    GenerateRuleSuggestionsOutput,
} from "../agents/rule.suggestion.agent.js";
import { JOB_STATUS } from "@monitor/shared/job/job.status.const.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import { TASK_SUMMARY } from "@monitor/run-api/public/task/tokens.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { ITaskSummary } from "@monitor/run-api/public/task/iservice/task.summary.iservice.js";
import type { ListRulesUseCase } from "@monitor/rules-api/application/rule/list.rules.usecase.js";
import type { RegisterSuggestionUseCase } from "@monitor/rules-api/application/rule/register.suggestion.usecase.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { RuleJobRepository } from "@monitor/rules-api/repository/job/rule.job.repository.js";
import type { RuleJobEntity } from "@monitor/rules-api/domain/job/rule.job.entity.js";
import {
    clampMaxRules,
    normalizeRuleSuggestionLanguage,
} from "@monitor/rules-api/domain/generation/task.rule.generation.params.policy.js";
import {
    MissingApiKeyError,
    TaskNotFoundForGenerationError,
} from "@monitor/rules-api/domain/generation/task.rule.generation.errors.js";

@Injectable()
export class RuleGenerationActivity {
    constructor(
        private readonly jobs: RuleJobRepository,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        @Inject(TASK_SUMMARY) private readonly taskSummary: ITaskSummary,
        private readonly listRules: ListRulesUseCase,
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        private readonly agent: RuleSuggestionAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifier: INotificationPublisher,
    ) {}

    toActivities(): {
        generateRuleProposals: (jobId: string) => Promise<void>;
        applyRuleProposals: (jobId: string) => Promise<number>;
        completeRuleGeneration: (jobId: string, rulesCreated: number) => Promise<void>;
        failRuleGeneration: (jobId: string, error: string) => Promise<void>;
    } {
        return {
            generateRuleProposals: (jobId) => this.generateRuleProposals(jobId),
            applyRuleProposals: (jobId) => this.applyRuleProposals(jobId),
            completeRuleGeneration: (jobId, rulesCreated) =>
                this.completeRuleGeneration(jobId, rulesCreated),
            failRuleGeneration: (jobId, error) => this.failRuleGeneration(jobId, error),
        };
    }

    // generate 단계: LLM 추론(결과 저장). 재시도 시 저장된 응답을 재사용하며 알림을 중복 발행하지 않는다.
    async generateRuleProposals(jobId: string): Promise<void> {
        const job = await this.loadJob(jobId);
        if (job.llmOutputJson) return;
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "rule-generation",
                status: "running",
                jobId,
                taskId: job.taskId,
            },
        });
        const info = Context.current().info;
        const idempotencyKey = `${info.workflowExecution?.workflowId ?? "wf"}-${info.activityId}`;
        const input = await this.loadGenerationInput(job.taskId, idempotencyKey);
        await this.runInference(job, input);
    }

    // apply 단계: 저장된 응답으로 규칙을 등록하고 새로 만든 수를 반환한다.
    async applyRuleProposals(jobId: string): Promise<number> {
        const job = await this.loadJob(jobId);
        if (!job.llmOutputJson) {
            throw new Error(`memoized LLM output missing for job ${jobId}`);
        }
        const output = JSON.parse(job.llmOutputJson) as GenerateRuleSuggestionsOutput;
        return this.applyProposals(job.taskId, output);
    }

    // complete 단계: 카운트·텔레메트리 기록 후 완료 알림. 재시도 시 멱등.
    async completeRuleGeneration(jobId: string, rulesCreated: number): Promise<void> {
        const job = await this.loadJob(jobId);
        if (job.status === JOB_STATUS.completed) return;
        if (!job.llmOutputJson) {
            throw new Error(`memoized LLM output missing for job ${jobId}`);
        }
        const output = JSON.parse(job.llmOutputJson) as GenerateRuleSuggestionsOutput;
        await this.jobs.markCompleted({
            id: jobId,
            rulesCreated,
            modelUsed: output.modelUsed,
            durationMs: output.durationMs,
            costUsd: output.costUsd,
            numTurns: output.numTurns,
            usage: output.usage,
            completedAt: new Date().toISOString(),
        });
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "rule-generation",
                status: "succeeded",
                jobId,
                taskId: job.taskId,
                summary:
                    rulesCreated === 0
                        ? "No new rules suggested"
                        : `${rulesCreated} ${rulesCreated === 1 ? "rule" : "rules"} suggested`,
                durationMs: output.durationMs,
            },
        });
    }

    async failRuleGeneration(jobId: string, error: string): Promise<void> {
        const job = await this.jobs.findById(jobId);
        await this.jobs.incrementAndMarkFailed({
            id: jobId,
            error: truncate(error, 1000),
            completedAt: new Date().toISOString(),
        });
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "rule-generation",
                status: "failed",
                jobId,
                ...(job?.taskId ? { taskId: job.taskId } : {}),
                error: error.length > 240 ? error.slice(0, 240) + "..." : error,
            },
        });
    }

    private async loadJob(
        jobId: string,
    ): Promise<RuleJobEntity & { taskId: string }> {
        const job = await this.jobs.findById(jobId);
        if (!job) throw new Error(`rule job not found: ${jobId}`);
        if (!job.taskId) throw new Error(`rule job missing taskId: ${jobId}`);
        return job as RuleJobEntity & { taskId: string };
    }

    private async loadGenerationInput(
        taskId: string,
        idempotencyKey?: string,
    ): Promise<GenerateRuleSuggestionsInput> {
        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) {
            throw new MissingApiKeyError();
        }
        const modelOverride = await this.settings.getAnthropicModel();
        const maxRulesRaw = await this.settings.getRawValue(
            APP_SETTING_KEYS.ruleGenMaxRulesPerTask,
        );
        const maxRules = clampMaxRules(maxRulesRaw);
        const languageRaw = await this.settings.getRawValue(
            APP_SETTING_KEYS.claudeOutputLanguage,
        );
        const language = normalizeRuleSuggestionLanguage(languageRaw);

        const { summary } = await this.taskSummary.execute({ taskId });
        if (!summary) {
            throw new TaskNotFoundForGenerationError(taskId);
        }

        const existingRules = await this.listRules.execute({ scope: "global" });
        const existingNames = existingRules.rules.map((r) => r.name);

        return {
            ...(apiKey ? { apiKey } : {}),
            ...(modelOverride ? { model: modelOverride } : {}),
            summary,
            existingRuleNames: existingNames,
            maxRules,
            language,
            ...(idempotencyKey ? { idempotencyKey } : {}),
        };
    }

    // 저장된 응답이 있으면 호출을 건너뛰고, 없으면 호출 후 저장한다.
    private async runInference(
        job: RuleJobEntity,
        input: GenerateRuleSuggestionsInput,
    ): Promise<GenerateRuleSuggestionsOutput> {
        if (job.llmOutputJson) {
            return JSON.parse(job.llmOutputJson) as GenerateRuleSuggestionsOutput;
        }
        const output = await this.agent.generate(input);
        await this.jobs.saveLlmOutput(
            job.id,
            JSON.stringify(output),
            new Date().toISOString(),
        );
        return output;
    }

    private async applyProposals(
        taskId: string,
        output: GenerateRuleSuggestionsOutput,
    ): Promise<number> {
        let rulesCreated = 0;
        for (const proposal of output.rules) {
            const result = await this.registerSuggestion.execute({
                name: proposal.name,
                ...(proposal.trigger ? { trigger: proposal.trigger } : {}),
                ...(proposal.triggerOn ? { triggerOn: proposal.triggerOn } : {}),
                expect: {
                    ...(proposal.expect.action !== undefined
                        ? { action: proposal.expect.action }
                        : {}),
                    ...(proposal.expect.commandMatches !== undefined
                        ? { commandMatches: [...proposal.expect.commandMatches] }
                        : {}),
                    ...(proposal.expect.pattern !== undefined
                        ? { pattern: proposal.expect.pattern }
                        : {}),
                },
                scope: "task",
                taskId,
                severity: "info",
                rationale: proposal.rationale,
            });
            if (result.created) rulesCreated++;
        }
        return rulesCreated;
    }
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}

import { Inject, Injectable, Logger } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { randomUUID } from "node:crypto";
import {
    RuleSuggestionAgent,
    type GenerateRuleSuggestionsInput,
    type GenerateRuleSuggestionsOutput,
} from "../agent/rule.suggestion.agent.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { ITaskSummary } from "@monitor/run-api/task/public/iservice/task.summary.iservice.js";
import { TASK_SUMMARY } from "@monitor/run-api/task/public/tokens.js";
import { ListRulesUseCase } from "@monitor/rules-api/rule/application/list.rules.usecase.js";
import { RegisterSuggestionUseCase } from "@monitor/rules-api/rule/application/register.suggestion.usecase.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { RuleJobRepository } from "../../../job/rule.job.repository.js";
import type { RuleJobEntity } from "../../../job/rule.job.entity.js";
import {
    clampMaxRules,
    normalizeRuleSuggestionLanguage,
} from "../domain/task.rule.generation.params.policy.js";
import {
    GenerationAlreadyInFlightError,
    MissingApiKeyError,
    TaskHasNoEventsError,
    TaskNotFoundForGenerationError,
} from "../domain/task.rule.generation.errors.js";

@Injectable()
export class TaskRuleGenerationService {
    private readonly logger = new Logger(TaskRuleGenerationService.name);

    constructor(
        private readonly jobs: RuleJobRepository,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        @Inject(TASK_SUMMARY) private readonly taskSummary: ITaskSummary,
        private readonly listRules: ListRulesUseCase,
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        private readonly agent: RuleSuggestionAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly notifier: INotificationPublisher,
    ) {}

    async enqueue(taskId: string): Promise<RuleJobEntity> {
        const { summary } = await this.taskSummary.execute({ taskId });
        if (!summary) {
            // 태스크가 없으면 생성 잡을 만들지 않고 요청을 실패시킨다.
            throw new TaskNotFoundForGenerationError(taskId);
        }
        if (summary.eventCount === 0) {
            // 이벤트가 없는 태스크는 학습할 규칙 근거가 없으므로 생성하지 않는다.
            throw new TaskHasNoEventsError(taskId);
        }
        const existing = await this.jobs.findActiveForTask("rule_generation", taskId);
        if (existing) {
            // 같은 태스크의 생성 잡은 동시에 하나만 허용한다.
            throw new GenerationAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) {
            // 로컬 실행기가 API 키를 직접 써야 하면 잡을 만들기 전에 거부한다.
            throw new MissingApiKeyError();
        }

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "rule_generation",
            taskId,
            createdAt: new Date().toISOString(),
        });
    }

    async run(taskId: string): Promise<RuleJobEntity> {
        const job = await this.enqueue(taskId);
        await this.execute(job);
        const completed = await this.findById(job.id);
        return completed ?? job;
    }

    async findLatest(taskId: string): Promise<RuleJobEntity | null> {
        return this.jobs.findLatestForTask("rule_generation", taskId);
    }

    async findById(id: string): Promise<RuleJobEntity | null> {
        return this.jobs.findById(id);
    }

    async execute(job: RuleJobEntity): Promise<void> {
        const taskId = job.taskId;
        if (!taskId) {
            // taskId가 없는 rule_generation 잡은 복구할 대상이 없어 실패로 닫는다.
            await this.jobs.markFailed({
                id: job.id,
                error: "rule generation job is missing a taskId",
                attempts: job.attempts,
                completedAt: new Date().toISOString(),
            });
            return;
        }
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "rule-generation",
                status: "running",
                jobId: job.id,
                taskId,
            },
        });
        try {
            const input = await this.loadGenerationInput(taskId);
            const output = await this.runInference(job, input);
            const rulesCreated = await this.applyProposals(taskId, output);
            await this.completeGeneration(job.id, output, rulesCreated);
            this.notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "rule-generation",
                    status: "succeeded",
                    jobId: job.id,
                    taskId,
                    summary:
                        rulesCreated === 0
                            ? "No new rules suggested"
                            : `${rulesCreated} ${rulesCreated === 1 ? "rule" : "rules"} suggested`,
                    durationMs: output.durationMs,
                },
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
                `Rule generation failed for task=${taskId} job=${job.id}: ${message}`,
            );
            const attempts = await this.jobs.incrementAttempts(
                job.id,
                new Date().toISOString(),
            );
            await this.jobs.markFailed({
                id: job.id,
                error: truncate(message, 1000),
                attempts,
                completedAt: new Date().toISOString(),
            });
            this.notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "rule-generation",
                    status: "failed",
                    jobId: job.id,
                    taskId,
                    error: truncate(message, 240),
                },
            });
        }
    }

    // 컨텍스트를 모아 LLM 입력을 만든다. Temporal 활동에서도 직접 호출한다.
    async loadGenerationInput(taskId: string): Promise<GenerateRuleSuggestionsInput> {
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
        };
    }

    // 저장된 응답이 있으면 호출을 건너뛰고, 없으면 호출 후 저장한다.
    async runInference(
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

    // 제안된 규칙을 등록하고 새로 생성된 수를 돌려준다.
    async applyProposals(
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

    // 결과 카운트와 텔레메트리를 기록하고 잡을 완료로 닫는다.
    async completeGeneration(
        jobId: string,
        output: GenerateRuleSuggestionsOutput,
        rulesCreated: number,
    ): Promise<void> {
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
    }

    // 워커에서 재시도가 모두 소진된 잡을 실패로 닫는다.
    async markGenerationFailed(jobId: string, error: string): Promise<void> {
        const attempts = await this.jobs.incrementAttempts(
            jobId,
            new Date().toISOString(),
        );
        await this.jobs.markFailed({
            id: jobId,
            error: truncate(error, 1000),
            attempts,
            completedAt: new Date().toISOString(),
        });
    }
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}

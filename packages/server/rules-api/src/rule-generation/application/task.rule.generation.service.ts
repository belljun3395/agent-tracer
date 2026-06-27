import { Inject, Injectable, Logger } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { randomUUID } from "node:crypto";
import { RuleSuggestionAgent } from "./rule.suggestion.agent.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { GetTaskSummaryUseCase } from "@monitor/run-api/task/application/get.task.summary.usecase.js";
import { ListRulesUseCase } from "@monitor/rules-api/rule/application/list.rules.usecase.js";
import { RegisterSuggestionUseCase } from "@monitor/rules-api/rule/application/register.suggestion.usecase.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import { AppSettingService } from "@monitor/identity-api/settings/application/app.setting.service.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { RuleJobRepository } from "../../job/rule.job.repository.js";
import type { RuleJobEntity } from "../../job/rule.job.entity.js";
import {
    clampMaxRules,
    normalizeRuleSuggestionLanguage,
} from "../domain/task.rule.generation.params.js";

export class TaskNotFoundForGenerationError extends Error {
    constructor(public readonly taskId: string) {
        super(`Task not found: ${taskId}`);
        this.name = "TaskNotFoundForGenerationError";
    }
}

export class TaskHasNoEventsError extends Error {
    constructor(public readonly taskId: string) {
        super(`Task ${taskId} has no events to analyze yet.`);
        this.name = "TaskHasNoEventsError";
    }
}

export class GenerationAlreadyInFlightError extends Error {
    constructor(public readonly jobId: string) {
        super(`A generation job is already in flight (jobId=${jobId}).`);
        this.name = "GenerationAlreadyInFlightError";
    }
}

export class MissingApiKeyError extends Error {
    constructor() {
        super("No Anthropic API key configured. Set anthropic.api_key in Settings.");
        this.name = "MissingApiKeyError";
    }
}

@Injectable()
export class TaskRuleGenerationService {
    private readonly logger = new Logger(TaskRuleGenerationService.name);

    constructor(
        private readonly jobs: RuleJobRepository,
        private readonly settings: AppSettingService,
        private readonly getTaskSummary: GetTaskSummaryUseCase,
        private readonly listRules: ListRulesUseCase,
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        private readonly agent: RuleSuggestionAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly notifier: INotificationPublisher,
    ) {}

    async enqueue(taskId: string): Promise<RuleJobEntity> {
        const { summary } = await this.getTaskSummary.execute({ taskId });
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
            const apiKey = await this.settings.getAnthropicApiKey();
            if (this.agent.requiresLocalApiKey() && !apiKey) {
                // 실행 시점에도 키를 다시 확인해 오래된 pending 잡이 잘못 실행되지 않게 한다.
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

            const { summary } = await this.getTaskSummary.execute({ taskId });
            if (!summary) {
                // enqueue 이후 태스크가 삭제되면 잡을 실패로 닫는다.
                throw new TaskNotFoundForGenerationError(taskId);
            }

            const existingRules = await this.listRules.execute({ scope: "global" });
            const existingNames = existingRules.rules.map((r) => r.name);

            const output = await this.agent.generate({
                ...(apiKey ? { apiKey } : {}),
                ...(modelOverride ? { model: modelOverride } : {}),
                summary,
                existingRuleNames: existingNames,
                maxRules,
                language,
            });

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

            await this.jobs.markCompleted({
                id: job.id,
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
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}

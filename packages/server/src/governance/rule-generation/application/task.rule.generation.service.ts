import { Inject, Injectable, Logger } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "~adapters/notifications/dto/notification.type.const.js";
import { randomUUID } from "node:crypto";
import { RuleSuggestionAgent } from "~adapters/llm/rule.suggestion.agent.js";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import { GetTaskSummaryUseCase } from "~work/task/application/get.task.summary.usecase.js";
import { ListRulesUseCase } from "~governance/rule/application/list.rules.usecase.js";
import { RegisterSuggestionUseCase } from "~governance/rule/application/register.suggestion.usecase.js";
import { APP_SETTING_KEYS } from "~governance/settings/domain/app.setting.keys.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import { GovernanceJobRepository } from "~governance/job/governance.job.repository.js";
import type { GovernanceJobEntity } from "~governance/job/governance.job.entity.js";
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
        private readonly jobs: GovernanceJobRepository,
        private readonly settings: AppSettingService,
        private readonly getTaskSummary: GetTaskSummaryUseCase,
        private readonly listRules: ListRulesUseCase,
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        private readonly agent: RuleSuggestionAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly notifier: INotificationPublisher,
    ) {}

    async enqueue(taskId: string): Promise<GovernanceJobEntity> {
        const { summary } = await this.getTaskSummary.execute({ taskId });
        if (!summary) {
            throw new TaskNotFoundForGenerationError(taskId);
        }
        if (summary.eventCount === 0) {
            throw new TaskHasNoEventsError(taskId);
        }
        const existing = await this.jobs.findActiveForTask("rule_generation", taskId);
        if (existing) {
            throw new GenerationAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) {
            throw new MissingApiKeyError();
        }

        return this.jobs.insert({
            id: randomUUID(),
            jobType: "rule_generation",
            taskId,
            createdAt: new Date().toISOString(),
        });
    }

    /** API 요청 안에서 룰 생성을 동기 실행하고 완료된 잡을 반환한다. */
    async run(taskId: string): Promise<GovernanceJobEntity> {
        const job = await this.enqueue(taskId);
        await this.execute(job);
        const completed = await this.findById(job.id);
        return completed ?? job;
    }

    async findLatest(taskId: string): Promise<GovernanceJobEntity | null> {
        return this.jobs.findLatestForTask("rule_generation", taskId);
    }

    async findById(id: string): Promise<GovernanceJobEntity | null> {
        return this.jobs.findById(id);
    }

    /**
     * Execute one claimed job. Caller is responsible for atomic claim before
     * calling. Updates job status to completed/failed at the end.
     */
    async execute(job: GovernanceJobEntity): Promise<void> {
        const taskId = job.taskId;
        if (!taskId) {
            // rule_generation jobs always carry a taskId; a missing one is a
            // corrupt row — fail it rather than crash the worker.
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

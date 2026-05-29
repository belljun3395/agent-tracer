import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RuleSuggestionAgent } from "~adapters/llm/rule.suggestion.agent.js";
import type { RuleSuggestionLanguage } from "~adapters/llm/rule.suggestion.prompt.js";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import { GetTaskSummaryUseCase } from "~work/task/application/get.task.summary.usecase.js";
import { ListRulesUseCase } from "~governance/rule/application/list.rules.usecase.js";
import { RegisterSuggestionUseCase } from "~governance/rule/application/register.suggestion.usecase.js";
import { APP_SETTING_KEYS } from "~governance/settings/domain/app.setting.keys.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import { TaskRuleGenerationJobRepository } from "../repository/task.rule.generation.job.repository.js";
import type { TaskRuleGenerationJobEntity } from "../domain/task.rule.generation.job.entity.js";

const DEFAULT_MAX_RULES = 5;

const SUPPORTED_LANGUAGES: ReadonlySet<RuleSuggestionLanguage> = new Set([
    "auto",
    "ko",
    "en",
    "ja",
    "zh",
]);

function normalizeLanguage(raw: string | null): RuleSuggestionLanguage {
    if (!raw) return "auto";
    const trimmed = raw.trim().toLowerCase() as RuleSuggestionLanguage;
    return SUPPORTED_LANGUAGES.has(trimmed) ? trimmed : "auto";
}

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
        private readonly jobs: TaskRuleGenerationJobRepository,
        private readonly settings: AppSettingService,
        private readonly getTaskSummary: GetTaskSummaryUseCase,
        private readonly listRules: ListRulesUseCase,
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        private readonly agent: RuleSuggestionAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly notifier: INotificationPublisher,
    ) {}

    async enqueue(taskId: string): Promise<TaskRuleGenerationJobEntity> {
        const { summary } = await this.getTaskSummary.execute({ taskId });
        if (!summary) {
            throw new TaskNotFoundForGenerationError(taskId);
        }
        if (summary.eventCount === 0) {
            throw new TaskHasNoEventsError(taskId);
        }
        const existing = await this.jobs.findActiveForTask(taskId);
        if (existing) {
            throw new GenerationAlreadyInFlightError(existing.id);
        }

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) {
            throw new MissingApiKeyError();
        }

        return this.jobs.insert({
            id: randomUUID(),
            taskId,
            createdAt: new Date().toISOString(),
        });
    }

    async findLatest(taskId: string): Promise<TaskRuleGenerationJobEntity | null> {
        return this.jobs.findLatestForTask(taskId);
    }

    async findById(id: string): Promise<TaskRuleGenerationJobEntity | null> {
        return this.jobs.findById(id);
    }

    /**
     * Execute one claimed job. Caller is responsible for atomic claim before
     * calling. Updates job status to completed/failed at the end.
     */
    async execute(job: TaskRuleGenerationJobEntity): Promise<void> {
        const taskId = job.taskId;
        this.notifier.publish({
            type: "sdk_job.updated",
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
            const language = normalizeLanguage(languageRaw);

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
                type: "sdk_job.updated",
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
                type: "sdk_job.updated",
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

function clampMaxRules(raw: string | null): number {
    if (!raw) return DEFAULT_MAX_RULES;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_RULES;
    return Math.min(Math.max(n, 1), 20);
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}

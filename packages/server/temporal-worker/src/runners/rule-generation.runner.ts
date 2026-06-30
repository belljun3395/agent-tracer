import type {
    RuleSuggestionAgent,
    GenerateRuleSuggestionsInput,
    GenerateRuleSuggestionsOutput,
} from "../agents/rule.suggestion.agent.js";
import type { ITaskSummary } from "@monitor/run-api/task/public/iservice/task.summary.iservice.js";
import type { ListRulesUseCase } from "@monitor/rules-api/rule/application/list.rules.usecase.js";
import type { RegisterSuggestionUseCase } from "@monitor/rules-api/rule/application/register.suggestion.usecase.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import type { RuleJobRepository } from "@monitor/rules-api/job/rule.job.repository.js";
import type { RuleJobEntity } from "@monitor/rules-api/job/rule.job.entity.js";
import {
    clampMaxRules,
    normalizeRuleSuggestionLanguage,
} from "@monitor/rules-api/rule/generation/domain/task.rule.generation.params.policy.js";
import {
    MissingApiKeyError,
    TaskNotFoundForGenerationError,
} from "@monitor/rules-api/rule/generation/domain/task.rule.generation.errors.js";

// 규칙 생성 잡의 실행 오케스트레이션. 추론·적용·알림·실패 처리를 워커가 소유한다.
export class RuleGenerationRunner {
    constructor(
        private readonly jobs: RuleJobRepository,
        private readonly settings: IAppSettings,
        private readonly taskSummary: ITaskSummary,
        private readonly listRules: ListRulesUseCase,
        private readonly registerSuggestion: RegisterSuggestionUseCase,
        private readonly agent: RuleSuggestionAgent,
        private readonly notifier: INotificationPublisher,
    ) {}

    // generate 단계: 시작 알림 → LLM 추론(결과 저장).
    async runGeneration(jobId: string): Promise<void> {
        const job = await this.loadJob(jobId);
        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "rule-generation",
                status: "running",
                jobId,
                taskId: job.taskId,
            },
        });
        const input = await this.loadGenerationInput(job.taskId);
        await this.runInference(job, input);
    }

    // apply 단계: 저장된 응답으로 규칙 등록·완료 → 성공 알림.
    async applyGeneration(jobId: string): Promise<number> {
        const job = await this.loadJob(jobId);
        if (!job.llmOutputJson) {
            throw new Error(`memoized LLM output missing for job ${jobId}`);
        }
        const output = JSON.parse(job.llmOutputJson) as GenerateRuleSuggestionsOutput;
        const rulesCreated = await this.applyProposals(job.taskId, output);
        await this.completeGeneration(job.id, output, rulesCreated);
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
        return rulesCreated;
    }

    private async loadJob(
        jobId: string,
    ): Promise<RuleJobEntity & { taskId: string }> {
        const job = await this.jobs.findById(jobId);
        if (!job) throw new Error(`rule job not found: ${jobId}`);
        if (!job.taskId) throw new Error(`rule job missing taskId: ${jobId}`);
        return job as RuleJobEntity & { taskId: string };
    }

    // 컨텍스트를 모아 LLM 입력을 만든다.
    private async loadGenerationInput(
        taskId: string,
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

    // 제안된 규칙을 등록하고 새로 생성된 수를 돌려준다.
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

    // 결과 카운트와 텔레메트리를 기록하고 잡을 완료로 닫는다.
    private async completeGeneration(
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

    // 재시도가 모두 소진된 잡을 실패로 닫고 알린다.
    async markGenerationFailed(jobId: string, error: string): Promise<void> {
        const job = await this.jobs.findById(jobId);
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
}

function truncate(s: string, n: number): string {
    return s.length <= n ? s : s.slice(0, n) + "...";
}

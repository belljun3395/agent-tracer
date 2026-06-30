import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { normalizeOutputLanguage } from "@monitor/shared/llm/output.language.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { TitleSuggestionAgent } from "../agents/title.suggestion.agent.js";
import type { SuggestionLanguage } from "../agents/title.suggestion.prompt.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { GetTaskSummaryUseCase } from "@monitor/run-api/task/application/get.task.summary.usecase.js";
import {
    TaskHasNoEventsError,
    TaskNotFoundError,
} from "@monitor/run-api/task/common/task.errors.js";
import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/task/application/dto/suggest.task.title.usecase.dto.js";

export class MissingApiKeyError extends Error {
    constructor() {
        super("No Anthropic API key configured. Set anthropic.api_key in Settings.");
        this.name = "MissingApiKeyError";
    }
}

// 제목 제안 실행 오케스트레이션. LLM 호출·알림을 워커가 소유한다.
export class TitleSuggestionRunner {
    constructor(
        private readonly getSummary: GetTaskSummaryUseCase,
        private readonly settings: IAppSettings,
        private readonly agent: TitleSuggestionAgent,
        private readonly notifier: INotificationPublisher,
    ) {}

    async runSuggestion(
        taskId: string,
        idempotencyKey?: string,
    ): Promise<SuggestTaskTitleUseCaseOut> {
        const { summary } = await this.getSummary.execute({ taskId });
        if (!summary) throw new TaskNotFoundError(taskId);
        if (summary.eventCount === 0) throw new TaskHasNoEventsError(taskId);

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) throw new MissingApiKeyError();
        const modelOverride = await this.settings.getAnthropicModel();
        const languageRaw = await this.settings.getRawValue(
            APP_SETTING_KEYS.claudeOutputLanguage,
        );
        const language: SuggestionLanguage = normalizeOutputLanguage(languageRaw);

        this.notifier.publish({
            type: NOTIFICATION_TYPE.sdkJobUpdated,
            payload: {
                kind: "title-suggestion",
                status: "running",
                taskId,
            },
        });

        try {
            const output = await this.agent.generate({
                ...(apiKey ? { apiKey } : {}),
                ...(modelOverride ? { model: modelOverride } : {}),
                summary,
                language,
                ...(idempotencyKey ? { idempotencyKey } : {}),
            });

            const suggestions = output.suggestions.filter(
                (s) => s.title.trim() !== summary.title.trim(),
            );
            this.notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "title-suggestion",
                    status: "succeeded",
                    taskId,
                    summary:
                        suggestions.length === 0
                            ? "No title alternatives produced"
                            : `${suggestions.length} title ${suggestions.length === 1 ? "suggestion" : "suggestions"}`,
                    durationMs: output.durationMs,
                },
            });

            return {
                suggestions,
                modelUsed: output.modelUsed,
                durationMs: output.durationMs,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.notifier.publish({
                type: NOTIFICATION_TYPE.sdkJobUpdated,
                payload: {
                    kind: "title-suggestion",
                    status: "failed",
                    taskId,
                    error: message.length > 240 ? message.slice(0, 240) + "..." : message,
                },
            });
            throw err;
        }
    }
}

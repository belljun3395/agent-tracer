import { Injectable, Inject } from "@nestjs/common";
import { Context } from "@temporalio/activity";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { normalizeOutputLanguage } from "@monitor/shared/llm/output.language.js";
import type { INotificationPublisher } from "@monitor/shared/contracts/notifications/notification.publisher.port.js";
import { TitleSuggestionAgent } from "../agents/title.suggestion.agent.js";
import type { SuggestionLanguage } from "../agents/title.suggestion.prompt.js";
import { APP_SETTING_KEYS } from "@monitor/identity-api/settings/domain/app.setting.keys.js";
import { APP_SETTINGS } from "@monitor/identity-api/settings/public/tokens.js";
import type { IAppSettings } from "@monitor/identity-api/settings/public/iservice/app.settings.iservice.js";
import { TASK_SUMMARY } from "@monitor/run-api/public/task/tokens.js";
import type { ITaskSummary } from "@monitor/run-api/public/task/iservice/task.summary.iservice.js";
import {
    TaskHasNoEventsError,
    TaskNotFoundError,
} from "@monitor/run-api/domain/task/task.errors.js";
import type { SuggestTaskTitleUseCaseOut } from "@monitor/run-api/public/task/title.suggestion.dto.js";
import { MissingApiKeyError } from "../activity.errors.js";

@Injectable()
export class TitleSuggestionActivity {
    constructor(
        @Inject(TASK_SUMMARY) private readonly getSummary: ITaskSummary,
        @Inject(APP_SETTINGS) private readonly settings: IAppSettings,
        private readonly agent: TitleSuggestionAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN) private readonly notifier: INotificationPublisher,
    ) {}

    toActivities(): {
        runTitleSuggestion: (taskId: string) => Promise<SuggestTaskTitleUseCaseOut>;
    } {
        return {
            runTitleSuggestion: (taskId) => this.runTitleSuggestion(taskId),
        };
    }

    // 재시도 간 동일한 키라 제공자가 중복 LLM 호출을 흡수한다.
    async runTitleSuggestion(taskId: string): Promise<SuggestTaskTitleUseCaseOut> {
        const info = Context.current().info;
        const idempotencyKey = `${info.workflowExecution?.workflowId ?? "wf"}-${info.activityId}`;
        return this.runSuggestion(taskId, idempotencyKey);
    }

    private async runSuggestion(
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
            payload: { kind: "title-suggestion", status: "running", taskId },
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

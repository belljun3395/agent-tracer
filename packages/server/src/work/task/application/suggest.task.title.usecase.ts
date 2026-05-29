import { Inject, Injectable } from "@nestjs/common";
import { TitleSuggestionAgent } from "~adapters/llm/title.suggestion.agent.js";
import type { SuggestionLanguage } from "~adapters/llm/title.suggestion.prompt.js";
import type { INotificationPublisher } from "~adapters/notifications/notification.publisher.port.js";
import { APP_SETTING_KEYS } from "~governance/settings/domain/app.setting.keys.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
import { NOTIFICATION_PUBLISHER_TOKEN } from "~main/presentation/database/database.provider.js";
import { GetTaskSummaryUseCase } from "./get.task.summary.usecase.js";
import type {
    SuggestTaskTitleUseCaseIn,
    SuggestTaskTitleUseCaseOut,
} from "./dto/suggest.task.title.usecase.dto.js";

const SUPPORTED_LANGUAGES: ReadonlySet<SuggestionLanguage> = new Set([
    "auto",
    "ko",
    "en",
    "ja",
    "zh",
]);

function normalizeLanguage(raw: string | null): SuggestionLanguage {
    if (!raw) return "auto";
    const trimmed = raw.trim().toLowerCase() as SuggestionLanguage;
    return SUPPORTED_LANGUAGES.has(trimmed) ? trimmed : "auto";
}

export class MissingApiKeyError extends Error {
    constructor() {
        super("No Anthropic API key configured. Set anthropic.api_key in Settings.");
        this.name = "MissingApiKeyError";
    }
}

@Injectable()
export class SuggestTaskTitleUseCase {
    constructor(
        private readonly getSummary: GetTaskSummaryUseCase,
        private readonly settings: AppSettingService,
        private readonly agent: TitleSuggestionAgent,
        @Inject(NOTIFICATION_PUBLISHER_TOKEN)
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(
        input: SuggestTaskTitleUseCaseIn,
    ): Promise<SuggestTaskTitleUseCaseOut> {
        const { summary } = await this.getSummary.execute({ taskId: input.taskId });
        if (!summary) return { status: "not_found" };
        if (summary.eventCount === 0) return { status: "no_events" };

        const apiKey = await this.settings.getAnthropicApiKey();
        if (this.agent.requiresLocalApiKey() && !apiKey) throw new MissingApiKeyError();
        const modelOverride = await this.settings.getAnthropicModel();
        const languageRaw = await this.settings.getRawValue(
            APP_SETTING_KEYS.claudeOutputLanguage,
        );
        const language = normalizeLanguage(languageRaw);

        this.notifier.publish({
            type: "sdk_job.updated",
            payload: {
                kind: "title-suggestion",
                status: "running",
                taskId: input.taskId,
            },
        });

        try {
            const output = await this.agent.generate({
                ...(apiKey ? { apiKey } : {}),
                ...(modelOverride ? { model: modelOverride } : {}),
                summary,
                language,
            });

            const suggestions = output.suggestions.filter(
                (s) => s.title.trim() !== summary.title.trim(),
            );
            this.notifier.publish({
                type: "sdk_job.updated",
                payload: {
                    kind: "title-suggestion",
                    status: "succeeded",
                    taskId: input.taskId,
                    summary:
                        suggestions.length === 0
                            ? "No title alternatives produced"
                            : `${suggestions.length} title ${suggestions.length === 1 ? "suggestion" : "suggestions"}`,
                    durationMs: output.durationMs,
                },
            });

            return {
                status: "ok",
                suggestions,
                modelUsed: output.modelUsed,
                durationMs: output.durationMs,
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.notifier.publish({
                type: "sdk_job.updated",
                payload: {
                    kind: "title-suggestion",
                    status: "failed",
                    taskId: input.taskId,
                    error: message.length > 240 ? message.slice(0, 240) + "..." : message,
                },
            });
            throw err;
        }
    }
}

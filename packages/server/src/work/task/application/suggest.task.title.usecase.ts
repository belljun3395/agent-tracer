import { Injectable } from "@nestjs/common";
import { TitleSuggestionAgent } from "~adapters/llm/title.suggestion.agent.js";
import type { SuggestionLanguage } from "~adapters/llm/title.suggestion.prompt.js";
import { APP_SETTING_KEYS } from "~governance/settings/domain/app.setting.keys.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
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
    ) {}

    async execute(
        input: SuggestTaskTitleUseCaseIn,
    ): Promise<SuggestTaskTitleUseCaseOut> {
        const { summary } = await this.getSummary.execute({ taskId: input.taskId });
        if (!summary) return { status: "not_found" };
        if (summary.eventCount === 0) return { status: "no_events" };

        const apiKey = await this.settings.getAnthropicApiKey();
        if (!apiKey) throw new MissingApiKeyError();
        const modelOverride = await this.settings.getAnthropicModel();
        const languageRaw = await this.settings.getRawValue(
            APP_SETTING_KEYS.claudeOutputLanguage,
        );
        const language = normalizeLanguage(languageRaw);

        const output = await this.agent.generate({
            apiKey,
            ...(modelOverride ? { model: modelOverride } : {}),
            summary,
            language,
        });

        return {
            status: "ok",
            suggestions: output.suggestions.filter(
                (s) => s.title.trim() !== summary.title.trim(),
            ),
            modelUsed: output.modelUsed,
            durationMs: output.durationMs,
        };
    }
}

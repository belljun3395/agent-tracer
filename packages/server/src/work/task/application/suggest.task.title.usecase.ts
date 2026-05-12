import { Injectable } from "@nestjs/common";
import { TitleSuggestionAgent } from "~adapters/llm/title.suggestion.agent.js";
import { AppSettingService } from "~governance/settings/application/app.setting.service.js";
import { GetTaskSummaryUseCase } from "./get.task.summary.usecase.js";
import type {
    SuggestTaskTitleUseCaseIn,
    SuggestTaskTitleUseCaseOut,
} from "./dto/suggest.task.title.usecase.dto.js";

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

        const output = await this.agent.generate({
            apiKey,
            ...(modelOverride ? { model: modelOverride } : {}),
            summary,
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

import { Inject, Injectable } from "@nestjs/common";
import type { TaskSummaryUseCaseDto } from "@monitor/work-api/task/application/dto/get.task.summary.usecase.dto.js";
import { QUERY_RUNNER, type IQueryRunner } from "@monitor/shared/llm/query.runner.port.js";
import {
    buildSystemPrompt,
    buildUserPrompt,
    type SuggestionLanguage,
} from "./title.suggestion.prompt.js";
import {
    titleSuggestionsListSchema,
    type TitleSuggestion,
} from "./title.suggestion.zod.js";
import { parseJsonStrict } from "@monitor/shared/llm/parse.json.js";

const DEFAULT_MODEL = "claude-haiku-4-5";

export interface GenerateTitleSuggestionsInput {
    /** Optional: omitted when a remote runner runs the SDK with its own local key. */
    readonly apiKey?: string;
    readonly model?: string;
    readonly summary: TaskSummaryUseCaseDto;
    readonly language?: SuggestionLanguage;
}

export interface GenerateTitleSuggestionsOutput {
    readonly suggestions: readonly TitleSuggestion[];
    readonly modelUsed: string;
    readonly durationMs: number;
}

@Injectable()
export class TitleSuggestionAgent {
    constructor(
        @Inject(QUERY_RUNNER) private readonly queryRunner: IQueryRunner,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.queryRunner.requiresLocalApiKey();
    }

    async generate(
        input: GenerateTitleSuggestionsInput,
    ): Promise<GenerateTitleSuggestionsOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const language: SuggestionLanguage = input.language ?? "auto";
        const userPrompt = buildUserPrompt(input.summary);
        const systemPrompt = buildSystemPrompt(language);

        const env: Record<string, string | undefined> = {
            ...(input.apiKey ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
            MONITOR_TASK_TITLE: "Title Suggestion · Auto Rename",
            MONITOR_TASK_ORIGIN: "server-sdk",
        };

        // Single-turn Haiku one-shot, no workspace tools; 120s deadline headroom.
        const { rawOutput, durationMs, errorSummary } = await this.queryRunner.run({
            label: "title-suggestion",
            prompt: userPrompt,
            systemPrompt,
            allowedTools: [],
            model,
            maxTurns: 1,
            deadlineMs: 120_000,
            env,
        });

        if (errorSummary || !rawOutput) {
            throw new TitleSuggestionAgentError(
                "SDK_AGENT_FAILED",
                `Claude Agent SDK returned an error${
                    errorSummary ? `: ${errorSummary}` : ""
                }`,
            );
        }

        const json = parseJsonStrict(rawOutput);
        if (json === null) {
            throw new TitleSuggestionAgentError(
                "OUTPUT_NOT_JSON",
                "Agent output was not parseable JSON",
            );
        }

        const parsed = titleSuggestionsListSchema.safeParse(json);
        if (!parsed.success) {
            throw new TitleSuggestionAgentError(
                "OUTPUT_SCHEMA_INVALID",
                `Agent output failed schema validation: ${parsed.error.message}`,
            );
        }

        return {
            suggestions: parsed.data.suggestions,
            modelUsed: model,
            durationMs,
        };
    }
}

export class TitleSuggestionAgentError extends Error {
    constructor(
        public readonly code:
            | "SDK_AGENT_FAILED"
            | "OUTPUT_NOT_JSON"
            | "OUTPUT_SCHEMA_INVALID",
        message: string,
    ) {
        super(message);
        this.name = "TitleSuggestionAgentError";
    }
}

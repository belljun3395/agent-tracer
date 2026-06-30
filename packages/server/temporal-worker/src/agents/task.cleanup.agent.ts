import { Inject, Injectable } from "@nestjs/common";
import { QUERY_RUNNER, type IQueryRunner, type AgentQueryUsage } from "@monitor/shared/llm/query.runner.port.js";
import {
    buildSystemPrompt,
    buildUserPrompt,
    type CleanupLanguage,
    type CleanupTaskSnapshot,
} from "./task.cleanup.prompt.js";
import {
    cleanupSuggestionsListSchema,
    type CleanupSuggestion,
} from "./task.cleanup.zod.js";
import { parseJsonStrict } from "@monitor/shared/llm/parse.json.js";
import { zodToOutputSchema } from "@monitor/shared/llm/output.schema.js";
import { CLAUDE_MODEL } from "@monitor/shared/llm/models.js";

const ALLOWED_TOOLS: readonly string[] = [];
const DEFAULT_MAX_TURNS = 1;
const DEFAULT_MODEL = CLAUDE_MODEL.haiku;

const CLEANUP_OUTPUT_SCHEMA = zodToOutputSchema(cleanupSuggestionsListSchema);

export interface GenerateCleanupSuggestionsInput {
    readonly apiKey?: string;
    readonly model?: string;
    readonly tasks: readonly CleanupTaskSnapshot[];
    readonly maxSuggestions: number;
    readonly language?: CleanupLanguage;
}

export interface GenerateCleanupSuggestionsOutput {
    readonly suggestions: readonly CleanupSuggestion[];
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
}

@Injectable()
export class TaskCleanupAgent {
    constructor(
        @Inject(QUERY_RUNNER) private readonly queryRunner: IQueryRunner,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.queryRunner.requiresLocalApiKey();
    }

    async generate(
        input: GenerateCleanupSuggestionsInput,
    ): Promise<GenerateCleanupSuggestionsOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const language: CleanupLanguage = input.language ?? "auto";
        const systemPrompt = buildSystemPrompt(language);
        const userPrompt = buildUserPrompt(input.tasks, input.maxSuggestions);

        const env: Record<string, string | undefined> = {
            ...(input.apiKey ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
            MONITOR_TASK_TITLE: "Task Cleanup · Auto Suggest",
            MONITOR_TASK_ORIGIN: "server-sdk",
        };

        const { rawOutput, structuredOutput, durationMs, errorSummary, costUsd, numTurns, usage } = await this.queryRunner.run({
            label: "task-cleanup",
            prompt: userPrompt,
            systemPrompt,
            allowedTools: ALLOWED_TOOLS,
            model,
            maxTurns: DEFAULT_MAX_TURNS,
            deadlineMs: 120_000,
            env,
            outputSchema: CLEANUP_OUTPUT_SCHEMA,
        });

        if (errorSummary || (!rawOutput && structuredOutput === null)) {
            throw new TaskCleanupAgentError(
                "SDK_AGENT_FAILED",
                `Claude Agent SDK returned an error${errorSummary ? `: ${errorSummary}` : ""}`,
            );
        }

        const json = structuredOutput ?? parseJsonStrict(rawOutput);
        if (json === null || json === undefined) {
            throw new TaskCleanupAgentError("OUTPUT_NOT_JSON", "Agent output was not parseable JSON");
        }

        const parsed = cleanupSuggestionsListSchema.safeParse(json);
        if (!parsed.success) {
            throw new TaskCleanupAgentError(
                "OUTPUT_SCHEMA_INVALID",
                `Agent output failed schema validation: ${parsed.error.message}`,
            );
        }

        return {
            suggestions: parsed.data.suggestions.slice(0, input.maxSuggestions),
            rawOutput,
            modelUsed: model,
            durationMs,
            costUsd,
            numTurns,
            usage,
        };
    }
}

export class TaskCleanupAgentError extends Error {
    constructor(
        public readonly code: "SDK_AGENT_FAILED" | "OUTPUT_NOT_JSON" | "OUTPUT_SCHEMA_INVALID",
        message: string,
    ) {
        super(message);
        this.name = "TaskCleanupAgentError";
    }
}

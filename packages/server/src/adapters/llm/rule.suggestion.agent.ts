import { Inject, Injectable } from "@nestjs/common";
import type { TaskSummaryUseCaseDto } from "~work/task/application/dto/get.task.summary.usecase.dto.js";
import { QUERY_RUNNER, type IQueryRunner } from "./query.runner.port.js";
import {
    buildSystemPrompt,
    buildUserPrompt,
    type RuleSuggestionLanguage,
} from "./rule.suggestion.prompt.js";
import {
    ruleSuggestionsListSchema,
    type RuleSuggestion,
} from "./rule.suggestion.zod.js";
import { parseJsonStrict } from "./parse.json.js";

const ALLOWED_TOOLS = ["Read", "Glob", "Grep"];
const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface GenerateRuleSuggestionsInput {
    /** Optional: omitted when a remote runner runs the SDK with its own local key. */
    readonly apiKey?: string;
    readonly model?: string;
    readonly summary: TaskSummaryUseCaseDto;
    readonly existingRuleNames: readonly string[];
    readonly maxRules: number;
    readonly language?: RuleSuggestionLanguage;
}

export interface GenerateRuleSuggestionsOutput {
    readonly rules: readonly RuleSuggestion[];
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
}

@Injectable()
export class RuleSuggestionAgent {
    constructor(
        @Inject(QUERY_RUNNER) private readonly queryRunner: IQueryRunner,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.queryRunner.requiresLocalApiKey();
    }

    async generate(
        input: GenerateRuleSuggestionsInput,
    ): Promise<GenerateRuleSuggestionsOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const language: RuleSuggestionLanguage = input.language ?? "auto";
        const systemPrompt = buildSystemPrompt(language);
        const userPrompt = buildUserPrompt(
            input.summary,
            input.existingRuleNames,
            input.maxRules,
        );
        const cwd = input.summary.workspacePath;

        const generatedTitle = buildGeneratedTaskTitle(input.summary.title);
        const env: Record<string, string | undefined> = {
            ...(input.apiKey ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
            MONITOR_TASK_TITLE: generatedTitle,
            MONITOR_TASK_ORIGIN: "server-sdk",
        };

        // Tool-using, up to 8 turns over the workspace; allow 300s before abort.
        const { rawOutput, durationMs, errorSummary } = await this.queryRunner.run({
            label: "rule-suggestion",
            prompt: userPrompt,
            systemPrompt,
            allowedTools: ALLOWED_TOOLS,
            ...(cwd ? { cwd } : {}),
            model,
            maxTurns: DEFAULT_MAX_TURNS,
            deadlineMs: 300_000,
            env,
        });

        if (errorSummary || !rawOutput) {
            throw new RuleSuggestionAgentError(
                "SDK_AGENT_FAILED",
                `Claude Agent SDK returned an error${
                    errorSummary ? `: ${errorSummary}` : ""
                }`,
            );
        }

        const json = parseJsonStrict(rawOutput);
        if (json === null) {
            throw new RuleSuggestionAgentError(
                "OUTPUT_NOT_JSON",
                "Agent output was not parseable JSON",
            );
        }

        const parsed = ruleSuggestionsListSchema.safeParse(json);
        if (!parsed.success) {
            throw new RuleSuggestionAgentError(
                "OUTPUT_SCHEMA_INVALID",
                `Agent output failed schema validation: ${parsed.error.message}`,
            );
        }

        return {
            rules: parsed.data.rules.slice(0, input.maxRules),
            rawOutput,
            modelUsed: model,
            durationMs,
        };
    }
}

export class RuleSuggestionAgentError extends Error {
    constructor(
        public readonly code: "SDK_AGENT_FAILED" | "OUTPUT_NOT_JSON" | "OUTPUT_SCHEMA_INVALID",
        message: string,
    ) {
        super(message);
        this.name = "RuleSuggestionAgentError";
    }
}

const MAX_PARENT_TITLE_LENGTH = 60;

function buildGeneratedTaskTitle(parentTitle: string): string {
    const trimmed = parentTitle.trim();
    const truncated =
        trimmed.length <= MAX_PARENT_TITLE_LENGTH
            ? trimmed
            : `${trimmed.slice(0, MAX_PARENT_TITLE_LENGTH - 1)}…`;
    return `${truncated} · Auto Rule Generate`;
}

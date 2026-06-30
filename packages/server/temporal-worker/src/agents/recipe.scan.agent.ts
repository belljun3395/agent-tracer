import { Inject, Injectable } from "@nestjs/common";
import { QUERY_RUNNER, type IQueryRunner, type AgentQueryUsage } from "@monitor/shared/llm/query.runner.port.js";
import {
    buildSystemPrompt,
    buildUserPrompt,
    type RecipeOutputLanguage,
    type RecipeTaskSnapshot,
} from "./recipe.scan.prompt.js";
import {
    recipeCandidatesListSchema,
    type RecipeCandidatePayload,
} from "./recipe.scan.zod.js";
import { parseJsonStrict } from "@monitor/shared/llm/parse.json.js";
import { zodToOutputSchema } from "@monitor/shared/llm/output.schema.js";
import { CLAUDE_MODEL } from "@monitor/shared/llm/models.js";

const DEFAULT_MODEL = CLAUDE_MODEL.sonnet;

const RECIPE_OUTPUT_SCHEMA = zodToOutputSchema(recipeCandidatesListSchema);

export interface GenerateRecipeCandidatesInput {
    readonly apiKey?: string;
    readonly model?: string;
    readonly tasks: readonly RecipeTaskSnapshot[];
    readonly maxCandidates: number;
    readonly language: RecipeOutputLanguage;
    readonly idempotencyKey?: string;
    readonly abortSignal?: AbortSignal;
}

export interface GenerateRecipeCandidatesOutput {
    readonly recipes: readonly RecipeCandidatePayload[];
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
    readonly costUsd: number | null;
    readonly numTurns: number | null;
    readonly usage: AgentQueryUsage | null;
}

@Injectable()
export class RecipeScanAgent {
    constructor(
        @Inject(QUERY_RUNNER) private readonly queryRunner: IQueryRunner,
    ) {}

    requiresLocalApiKey(): boolean {
        return this.queryRunner.requiresLocalApiKey();
    }

    async generate(
        input: GenerateRecipeCandidatesInput,
    ): Promise<GenerateRecipeCandidatesOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const systemPrompt = buildSystemPrompt();
        const userPrompt = buildUserPrompt(input.tasks, input.maxCandidates, input.language);

        const env: Record<string, string | undefined> = {
            ...(input.apiKey ? { ANTHROPIC_API_KEY: input.apiKey } : {}),
            MONITOR_TASK_TITLE: "Recipe Scan · Auto Cluster",
            MONITOR_TASK_ORIGIN: "server-sdk",
        };

        const { rawOutput, structuredOutput, durationMs, errorSummary, costUsd, numTurns, usage } = await this.queryRunner.run({
            label: "recipe-scan",
            prompt: userPrompt,
            systemPrompt,
            allowedTools: [],
            model,
            maxTurns: 1,
            deadlineMs: 300_000,
            env,
            outputSchema: RECIPE_OUTPUT_SCHEMA,
            ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
            ...(input.abortSignal ? { parentSignal: input.abortSignal } : {}),
        });

        if (errorSummary || (!rawOutput && structuredOutput === null)) {
            throw new RecipeScanAgentError(
                "SDK_AGENT_FAILED",
                `Claude Agent SDK returned an error${errorSummary ? `: ${errorSummary}` : ""}`,
            );
        }

        const json = structuredOutput ?? parseJsonStrict(rawOutput);
        if (json === null || json === undefined) {
            throw new RecipeScanAgentError("OUTPUT_NOT_JSON", "Agent output was not parseable JSON");
        }

        const parsed = recipeCandidatesListSchema.safeParse(json);
        if (!parsed.success) {
            throw new RecipeScanAgentError(
                "OUTPUT_SCHEMA_INVALID",
                `Agent output failed schema validation: ${parsed.error.message}`,
            );
        }

        return {
            recipes: parsed.data.recipes.slice(0, input.maxCandidates),
            rawOutput,
            modelUsed: model,
            durationMs,
            costUsd,
            numTurns,
            usage,
        };
    }
}

export class RecipeScanAgentError extends Error {
    constructor(
        public readonly code: "SDK_AGENT_FAILED" | "OUTPUT_NOT_JSON" | "OUTPUT_SCHEMA_INVALID",
        message: string,
    ) {
        super(message);
        this.name = "RecipeScanAgentError";
    }
}

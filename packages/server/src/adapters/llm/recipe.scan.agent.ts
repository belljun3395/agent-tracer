import { Injectable } from "@nestjs/common";
import { query } from "@anthropic-ai/claude-agent-sdk";
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

const ALLOWED_TOOLS = ["Read", "Glob", "Grep"];
const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface GenerateRecipeCandidatesInput {
    readonly apiKey: string;
    readonly model?: string;
    readonly tasks: readonly RecipeTaskSnapshot[];
    readonly maxCandidates: number;
    readonly language: RecipeOutputLanguage;
}

export interface GenerateRecipeCandidatesOutput {
    readonly recipes: readonly RecipeCandidatePayload[];
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
}

@Injectable()
export class RecipeScanAgent {
    async generate(
        input: GenerateRecipeCandidatesInput,
    ): Promise<GenerateRecipeCandidatesOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const systemPrompt = buildSystemPrompt(input.language);
        const userPrompt = buildUserPrompt(input.tasks, input.maxCandidates);
        const cwd = process.cwd();

        const env: Record<string, string | undefined> = {
            ...process.env,
            ANTHROPIC_API_KEY: input.apiKey,
            MONITOR_TASK_TITLE: "Recipe Scan · Auto Cluster",
        };

        const startedAt = Date.now();
        let collected = "";
        let resultText = "";
        let errorSummary: string | null = null;

        const q = query({
            prompt: userPrompt,
            options: {
                cwd,
                model,
                allowedTools: ALLOWED_TOOLS,
                tools: ALLOWED_TOOLS,
                maxTurns: DEFAULT_MAX_TURNS,
                systemPrompt,
                env,
                permissionMode: "bypassPermissions",
                strictMcpConfig: true,
                includePartialMessages: false,
            },
        });

        for await (const msg of q) {
            if (msg.type === "assistant") {
                for (const block of msg.message.content) {
                    if (block.type === "text") {
                        collected += block.text;
                    }
                }
                continue;
            }
            if (msg.type === "result") {
                if (msg.subtype === "success") {
                    resultText = msg.result;
                } else {
                    errorSummary = `${msg.subtype}${
                        msg.errors.length > 0
                            ? `: ${msg.errors.join("; ")}`
                            : ""
                    }`;
                }
                break;
            }
        }

        const durationMs = Date.now() - startedAt;
        const rawOutput = resultText || collected;

        if (errorSummary || !rawOutput) {
            throw new RecipeScanAgentError(
                "SDK_AGENT_FAILED",
                `Claude Agent SDK returned an error${
                    errorSummary ? `: ${errorSummary}` : ""
                }`,
            );
        }

        const json = parseJsonStrict(rawOutput);
        if (json === null) {
            throw new RecipeScanAgentError(
                "OUTPUT_NOT_JSON",
                "Agent output was not parseable JSON",
            );
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
        };
    }
}

export class RecipeScanAgentError extends Error {
    constructor(
        public readonly code:
            | "SDK_AGENT_FAILED"
            | "OUTPUT_NOT_JSON"
            | "OUTPUT_SCHEMA_INVALID",
        message: string,
    ) {
        super(message);
        this.name = "RecipeScanAgentError";
    }
}

function parseJsonStrict(raw: string): unknown {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
        if (fenceMatch && fenceMatch[1]) {
            try {
                return JSON.parse(fenceMatch[1]);
            } catch {
                return null;
            }
        }
        return null;
    }
}

import { Injectable } from "@nestjs/common";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TaskSummaryUseCaseDto } from "~work/task/application/dto/get.task.summary.usecase.dto.js";
import {
    buildSystemPrompt,
    buildUserPrompt,
    type SuggestionLanguage,
} from "./title.suggestion.prompt.js";
import {
    titleSuggestionsListSchema,
    type TitleSuggestion,
} from "./title.suggestion.zod.js";

const DEFAULT_MODEL = "claude-haiku-4-5";

export interface GenerateTitleSuggestionsInput {
    readonly apiKey: string;
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
    async generate(
        input: GenerateTitleSuggestionsInput,
    ): Promise<GenerateTitleSuggestionsOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const language: SuggestionLanguage = input.language ?? "auto";
        const userPrompt = buildUserPrompt(input.summary);
        const systemPrompt = buildSystemPrompt(language);

        const env: Record<string, string | undefined> = {
            ...process.env,
            ANTHROPIC_API_KEY: input.apiKey,
            MONITOR_TASK_TITLE: "Title Suggestion · Auto Rename",
            MONITOR_TASK_ORIGIN: "server-sdk",
        };

        const startedAt = Date.now();
        let collected = "";
        let resultText = "";
        let errorSummary: string | null = null;

        const q = query({
            prompt: userPrompt,
            options: {
                cwd: process.cwd(),
                model,
                allowedTools: [],
                tools: [],
                maxTurns: 1,
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

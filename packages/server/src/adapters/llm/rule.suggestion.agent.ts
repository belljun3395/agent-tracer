import { Injectable } from "@nestjs/common";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { TaskSummaryUseCaseDto } from "~work/task/application/dto/get.task.summary.usecase.dto.js";
import { SYSTEM_PROMPT, buildUserPrompt } from "./rule.suggestion.prompt.js";
import {
    ruleSuggestionsListSchema,
    type RuleSuggestion,
} from "./rule.suggestion.zod.js";

const ALLOWED_TOOLS = ["Read", "Glob", "Grep"];
const DEFAULT_MAX_TURNS = 8;
const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface GenerateRuleSuggestionsInput {
    readonly apiKey: string;
    readonly model?: string;
    readonly summary: TaskSummaryUseCaseDto;
    readonly existingRuleNames: readonly string[];
    readonly maxRules: number;
}

export interface GenerateRuleSuggestionsOutput {
    readonly rules: readonly RuleSuggestion[];
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
}

@Injectable()
export class RuleSuggestionAgent {
    async generate(
        input: GenerateRuleSuggestionsInput,
    ): Promise<GenerateRuleSuggestionsOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const userPrompt = buildUserPrompt(
            input.summary,
            input.existingRuleNames,
            input.maxRules,
        );
        const cwd = input.summary.workspacePath || process.cwd();

        const generatedTitle = buildGeneratedTaskTitle(input.summary.title);
        const env: Record<string, string | undefined> = {
            ...process.env,
            ANTHROPIC_API_KEY: input.apiKey,
            MONITOR_TASK_TITLE: generatedTitle,
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
                systemPrompt: SYSTEM_PROMPT,
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

function parseJsonStrict(raw: string): unknown {
    const trimmed = raw.trim();
    try {
        return JSON.parse(trimmed);
    } catch {
        // Tolerate fenced code blocks if the model couldn't resist them.
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

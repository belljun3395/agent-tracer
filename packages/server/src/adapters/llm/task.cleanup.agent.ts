import { Injectable } from "@nestjs/common";
import { query } from "@anthropic-ai/claude-agent-sdk";
import {
    SYSTEM_PROMPT,
    buildUserPrompt,
    type CleanupTaskSnapshot,
} from "./task.cleanup.prompt.js";
import {
    cleanupSuggestionsListSchema,
    type CleanupSuggestion,
} from "./task.cleanup.zod.js";

// Cleanup is a single-shot "analyze this list and emit JSON" task — no
// filesystem context needed. Keeping tools enabled (and an 8-turn budget)
// let the model wander through the workspace and pushed a 37-task scan to
// 2+ minutes. Drop both: one turn, zero tools, no exploration.
const ALLOWED_TOOLS: readonly string[] = [];
const DEFAULT_MAX_TURNS = 1;
const DEFAULT_MODEL = "claude-haiku-4-5";

export interface GenerateCleanupSuggestionsInput {
    readonly apiKey: string;
    readonly model?: string;
    readonly tasks: readonly CleanupTaskSnapshot[];
    readonly maxSuggestions: number;
}

export interface GenerateCleanupSuggestionsOutput {
    readonly suggestions: readonly CleanupSuggestion[];
    readonly rawOutput: string;
    readonly modelUsed: string;
    readonly durationMs: number;
}

@Injectable()
export class TaskCleanupAgent {
    async generate(
        input: GenerateCleanupSuggestionsInput,
    ): Promise<GenerateCleanupSuggestionsOutput> {
        const model = input.model?.trim() || DEFAULT_MODEL;
        const userPrompt = buildUserPrompt(input.tasks, input.maxSuggestions);
        const cwd = process.cwd();

        const env: Record<string, string | undefined> = {
            ...process.env,
            ANTHROPIC_API_KEY: input.apiKey,
            MONITOR_TASK_TITLE: "Task Cleanup · Auto Suggest",
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
                allowedTools: [...ALLOWED_TOOLS],
                tools: [...ALLOWED_TOOLS],
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
            throw new TaskCleanupAgentError(
                "SDK_AGENT_FAILED",
                `Claude Agent SDK returned an error${
                    errorSummary ? `: ${errorSummary}` : ""
                }`,
            );
        }

        const json = parseJsonStrict(rawOutput);
        if (json === null) {
            throw new TaskCleanupAgentError(
                "OUTPUT_NOT_JSON",
                "Agent output was not parseable JSON",
            );
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
        };
    }
}

export class TaskCleanupAgentError extends Error {
    constructor(
        public readonly code:
            | "SDK_AGENT_FAILED"
            | "OUTPUT_NOT_JSON"
            | "OUTPUT_SCHEMA_INVALID",
        message: string,
    ) {
        super(message);
        this.name = "TaskCleanupAgentError";
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

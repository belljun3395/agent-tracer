import { Injectable } from "@nestjs/common";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { createAgentDeadline } from "./agent.deadline.js";
import type {
    AgentQueryRequest,
    AgentQueryResult,
    AgentQueryUsage,
    IQueryRunner,
} from "./query.runner.port.js";

/**
 * Claude Agent SDK `query()` 를 서버 프로세스 안에서 실행한다.
 */
@Injectable()
export class LocalQueryRunner implements IQueryRunner {
    requiresLocalApiKey(): boolean {
        return true;
    }

    async run(request: AgentQueryRequest): Promise<AgentQueryResult> {
        const startedAt = Date.now();
        let collected = "";
        let resultText = "";
        let structuredOutput: unknown = null;
        let numTurns: number | null = null;
        let costUsd: number | null = null;
        let usage: AgentQueryUsage | null = null;
        let errorSummary: string | null = null;
        let errorSubtype: string | null = null;

        const deadline = createAgentDeadline(request.deadlineMs);
        const tools = [...request.allowedTools];
        // Preset mode appends our rules onto Claude Code's tool-use scaffolding;
        // excludeDynamicSections keeps the cacheable prefix stable across workspaces.
        const systemPrompt = request.useClaudeCodePreset
            ? {
                  type: "preset" as const,
                  preset: "claude_code" as const,
                  append: request.systemPrompt,
                  ...(request.excludeDynamicSections ? { excludeDynamicSections: true } : {}),
              }
            : request.systemPrompt;
        const q = query({
            prompt: request.prompt,
            options: {
                abortController: deadline.controller,
                ...(request.cwd ? { cwd: request.cwd } : {}),
                model: request.model,
                allowedTools: tools,
                tools,
                maxTurns: request.maxTurns,
                systemPrompt,
                // Structured-output mode: let the SDK enforce/retry the schema instead
                // of asking the prompt for JSON and parsing the text ourselves.
                ...(request.outputSchema
                    ? { outputFormat: { type: "json_schema" as const, schema: request.outputSchema } }
                    : {}),
                // Merge the server process env locally; the request only carries
                // the explicit additions (MONITOR_TASK_*, and the key in local mode).
                env: { ...process.env, ...request.env },
                permissionMode: "bypassPermissions",
                strictMcpConfig: true,
                includePartialMessages: false,
            },
        });

        try {
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
                    // Cost/usage/turns ride on both success and error result messages.
                    numTurns = msg.num_turns;
                    costUsd = msg.total_cost_usd;
                    usage = toUsage(msg.usage);
                    if (msg.subtype === "success") {
                        resultText = msg.result;
                        structuredOutput = msg.structured_output ?? null;
                    } else {
                        errorSubtype = msg.subtype;
                        errorSummary = `${msg.subtype}${
                            msg.errors.length > 0 ? `: ${msg.errors.join("; ")}` : ""
                        }`;
                    }
                    break;
                }
            }
        } finally {
            deadline.dispose();
        }

        return {
            rawOutput: resultText || collected,
            structuredOutput,
            durationMs: Date.now() - startedAt,
            numTurns,
            costUsd,
            usage,
            errorSummary,
            errorSubtype,
        };
    }
}

interface SdkUsage {
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_read_input_tokens: number;
    readonly cache_creation_input_tokens: number;
}

function toUsage(u: SdkUsage): AgentQueryUsage {
    return {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens,
        cacheCreationTokens: u.cache_creation_input_tokens,
    };
}

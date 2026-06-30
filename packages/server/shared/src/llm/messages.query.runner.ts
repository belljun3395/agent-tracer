import { Injectable } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";
import { createAgentDeadline } from "./agent.deadline.js";
import { logAgentQuery } from "./query.log.js";
import type {
    AgentQueryRequest,
    AgentQueryResult,
    AgentQueryUsage,
    IQueryRunner,
} from "./query.runner.port.js";

const STRUCTURED_TOOL_NAME = "emit_result";
const DEFAULT_MAX_OUTPUT_TOKENS = 4096;
const MAX_API_RETRIES = 3;

@Injectable()
export class MessagesQueryRunner implements IQueryRunner {
    requiresLocalApiKey(): boolean {
        return true;
    }

    async run(request: AgentQueryRequest): Promise<AgentQueryResult> {
        const startedAt = Date.now();
        const apiKey = request.env["ANTHROPIC_API_KEY"] ?? process.env["ANTHROPIC_API_KEY"];

        const client = new Anthropic({
            maxRetries: MAX_API_RETRIES,
            ...(apiKey ? { apiKey } : {}),
        });
        const deadline = createAgentDeadline(request.deadlineMs);
        if (request.parentSignal) {
            request.parentSignal.addEventListener("abort", () => deadline.controller.abort(), { once: true });
        }

        const tools: Anthropic.Messages.Tool[] | undefined = request.outputSchema
            ? [
                  {
                      name: STRUCTURED_TOOL_NAME,
                      description: "Return the result in the required structure.",
                      input_schema: request.outputSchema as Anthropic.Messages.Tool.InputSchema,
                  },
              ]
            : undefined;

        try {
            const message = await client.messages.create(
                {
                    model: request.model,
                    max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
                    system: request.systemPrompt,
                    messages: [{ role: "user", content: request.prompt }],
                    ...(tools
                        ? {
                              tools,
                              tool_choice: {
                                  type: "tool" as const,
                                  name: STRUCTURED_TOOL_NAME,
                                  disable_parallel_tool_use: true,
                              },
                          }
                        : {}),
                },
                {
                    signal: deadline.controller.signal,
                    ...(request.idempotencyKey
                        ? { idempotencyKey: request.idempotencyKey }
                        : {}),
                },
            );

            let structuredOutput: unknown = null;
            let text = "";
            for (const block of message.content) {
                if (block.type === "tool_use" && block.name === STRUCTURED_TOOL_NAME) {
                    structuredOutput = block.input;
                } else if (block.type === "text") {
                    text += block.text;
                }
            }

            const result: AgentQueryResult = {
                rawOutput: text,
                structuredOutput,
                durationMs: Date.now() - startedAt,
                numTurns: 1,
                costUsd: null,
                usage: toUsage(message.usage),
                errorSummary: null,
                errorSubtype: null,
            };
            logAgentQuery(request.label, request.model, result);
            return result;
        } catch (err) {
            const result: AgentQueryResult = {
                rawOutput: "",
                structuredOutput: null,
                durationMs: Date.now() - startedAt,
                numTurns: null,
                costUsd: null,
                usage: null,
                errorSummary: err instanceof Error ? err.message : String(err),
                errorSubtype: "messages_api_error",
            };
            logAgentQuery(request.label, request.model, result);
            return result;
        } finally {
            deadline.dispose();
        }
    }
}

function toUsage(u: Anthropic.Messages.Usage): AgentQueryUsage {
    return {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    };
}

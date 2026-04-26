import type {
    ILlmClient,
    LlmCompletionRequest,
    LlmCompletionResult,
    LlmMessage,
} from "~application/verification/summary/index.js";

interface AnthropicTextBlock {
    readonly type: string;
    readonly text?: string;
}

interface AnthropicResponse {
    readonly model: string;
    readonly content: readonly AnthropicTextBlock[];
    readonly usage?: {
        readonly input_tokens?: number;
        readonly output_tokens?: number;
        readonly cache_creation_input_tokens?: number;
        readonly cache_read_input_tokens?: number;
    };
}

interface AnthropicErrorResponse {
    readonly error?: {
        readonly message?: string;
    };
}

// Anthropic system blocks need at least ~1024 tokens (Sonnet/Opus) or 2048
// (Haiku) to qualify for prompt caching. Our system prompt is ~700 chars and
// will fall below that floor today; we still mark it so any future expansion
// of the prompt template is cached automatically.
export class AnthropicLlmClient implements ILlmClient {
    constructor(private readonly opts: { readonly apiKey: string; readonly model: string }) {}

    async complete(request: LlmCompletionRequest): Promise<LlmCompletionResult> {
        const systemText = request.messages.find((message) => message.role === "system")?.content ?? "";
        const messages = request.messages
            .filter((message) => message.role !== "system")
            .map(toAnthropicMessage);
        const system = systemText
            ? [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }]
            : [];
        const httpResponse = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
                "x-api-key": this.opts.apiKey,
            },
            body: JSON.stringify({
                model: this.opts.model,
                max_tokens: request.maxTokens ?? 600,
                temperature: request.temperature ?? 0.2,
                system,
                messages,
            }),
        });

        const body = await parseJson(httpResponse);
        if (!httpResponse.ok) {
            const message = isAnthropicErrorResponse(body)
                ? body.error?.message ?? httpResponse.statusText
                : httpResponse.statusText;
            throw new Error(`Anthropic request failed: ${message}`);
        }
        if (!isAnthropicResponse(body)) {
            throw new Error("Anthropic response did not match the expected message shape");
        }

        const text = body.content
            .filter((block) => block.type === "text")
            .map((block) => block.text ?? "")
            .join("");
        const tokensIn = sumTokensIn(body.usage);
        return {
            text,
            model: body.model,
            ...(tokensIn !== undefined ? { tokensIn } : {}),
            ...(body.usage?.output_tokens !== undefined
                ? { tokensOut: body.usage.output_tokens }
                : {}),
        };
    }
}

function sumTokensIn(usage: AnthropicResponse["usage"]): number | undefined {
    if (!usage) return undefined;
    const base = usage.input_tokens;
    if (base === undefined) return undefined;
    return base + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
}

function toAnthropicMessage(message: LlmMessage): { role: "user" | "assistant"; content: string } {
    return {
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content,
    };
}

async function parseJson(response: Response): Promise<unknown> {
    try {
        return await response.json() as unknown;
    } catch {
        return null;
    }
}

function isAnthropicResponse(value: unknown): value is AnthropicResponse {
    if (!isRecord(value)) return false;
    return typeof value.model === "string" && Array.isArray(value.content);
}

function isAnthropicErrorResponse(value: unknown): value is AnthropicErrorResponse {
    if (!isRecord(value) || !isRecord(value.error)) return false;
    return value.error.message === undefined || typeof value.error.message === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

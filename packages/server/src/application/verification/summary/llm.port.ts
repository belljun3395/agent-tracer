export interface LlmMessage {
    readonly role: "system" | "user" | "assistant";
    readonly content: string;
}

export interface LlmCompletionRequest {
    readonly messages: ReadonlyArray<LlmMessage>;
    readonly maxTokens?: number;
    readonly temperature?: number;
}

export interface LlmCompletionResult {
    readonly text: string;
    readonly model: string;
    readonly tokensIn?: number;
    readonly tokensOut?: number;
}

export class LlmUnavailableError extends Error {
    constructor(reason: string) {
        super(`LLM unavailable: ${reason}`);
        this.name = "LlmUnavailableError";
    }
}

export interface ILlmClient {
    complete(request: LlmCompletionRequest): Promise<LlmCompletionResult>;
}

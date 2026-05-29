/**
 * Wire contract for LLM agent query jobs the runtime pulls from the server.
 * Mirrors the server's adapters/llm query.runner.port + llm.job.broker shapes
 * (the two packages can't import each other, so the contract is duplicated as
 * plain JSON types). Kept minimal — only what the runtime worker needs.
 */
export interface AgentQueryRequest {
    readonly label: string;
    readonly prompt: string;
    readonly systemPrompt: string;
    readonly allowedTools: readonly string[];
    readonly cwd?: string;
    readonly model: string;
    readonly maxTurns: number;
    readonly deadlineMs: number;
    readonly env: Readonly<Record<string, string | undefined>>;
}

export interface AgentQueryResult {
    readonly rawOutput: string;
    readonly durationMs: number;
    readonly errorSummary: string | null;
}

export interface LlmWireJob {
    readonly id: string;
    readonly kind: string;
    readonly input: AgentQueryRequest;
    readonly enqueuedAt: number;
}

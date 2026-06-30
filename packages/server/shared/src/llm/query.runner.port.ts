export interface AgentQueryRequest {

    readonly label: string;
    readonly prompt: string;

    readonly systemPrompt: string;

    readonly useClaudeCodePreset?: boolean;

    readonly excludeDynamicSections?: boolean;
    readonly allowedTools: readonly string[];

    readonly cwd?: string;
    readonly model: string;
    readonly maxTurns: number;

    readonly deadlineMs: number;

    readonly env: Readonly<Record<string, string | undefined>>;

    readonly outputSchema?: Record<string, unknown>;

    readonly idempotencyKey?: string;
    readonly parentSignal?: AbortSignal;
}

export interface AgentQueryUsage {
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreationTokens: number;
}

export interface AgentQueryResult {

    readonly rawOutput: string;

    readonly structuredOutput: unknown;
    readonly durationMs: number;

    readonly numTurns: number | null;

    readonly costUsd: number | null;

    readonly usage: AgentQueryUsage | null;

    readonly errorSummary: string | null;

    readonly errorSubtype: string | null;
}

export interface IQueryRunner {

    requiresLocalApiKey(): boolean;
    run(request: AgentQueryRequest): Promise<AgentQueryResult>;
}

export const QUERY_RUNNER = "QUERY_RUNNER";

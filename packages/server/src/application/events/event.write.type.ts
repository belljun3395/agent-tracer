export interface EventPatchInput {
    readonly eventId: string;
    readonly displayTitle?: string | null;
}

export interface TaskTokenUsageInput {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly apiCalledAt?: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly cacheReadTokens: number;
    readonly cacheCreateTokens: number;
    readonly costUsd?: number;
    readonly durationMs?: number;
    readonly model?: string;
    readonly promptId?: string;
}

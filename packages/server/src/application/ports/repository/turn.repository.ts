export interface TurnInsertInput {
    readonly id: string;
    readonly sessionId: string;
    readonly index: number;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly assistantText: string;
}

export interface StoredTurn {
    readonly id: string;
    readonly sessionId: string;
    readonly index: number;
    readonly startedAt: string;
    readonly endedAt: string;
    readonly assistantText: string;
    readonly rulesEvaluatedCount: number;
    readonly aggregateVerdict: string | null;
}

export interface ITurnRepository {
    insert(input: TurnInsertInput): Promise<StoredTurn>;
    linkEvents(turnId: string, eventIds: readonly string[]): Promise<void>;
    countBySessionId(sessionId: string): Promise<number>;
    findLatestBySessionId(sessionId: string): Promise<StoredTurn | null>;
    updateAssistantResponse(turnId: string, assistantText: string, endedAt: string): Promise<void>;
    updateAggregateVerdict(turnId: string, verdict: "verified" | "unverifiable" | "contradicted" | null): Promise<void>;
    updateRulesEvaluatedCount(turnId: string, count: number): Promise<void>;
}

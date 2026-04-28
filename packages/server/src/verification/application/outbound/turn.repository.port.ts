/**
 * Legacy ITurnRepository contract — kept self-contained for the SQLite
 * adapter and the verification module's factory bindings until the
 * verification persistence tier moves to TypeORM-owned entities.
 */

export type TurnStatus = "open" | "closed";
export type TurnAggregateVerdict = "verified" | "unverifiable" | "contradicted" | null;

export interface TurnInsertInput {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: TurnStatus;
    readonly startedAt: string;
    readonly askedText?: string | null;
}

export interface StoredTurn {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: TurnStatus;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly askedText: string | null;
    readonly assistantText: string | null;
    readonly aggregateVerdict: TurnAggregateVerdict;
    readonly rulesEvaluatedCount: number;
}

export interface ITurnRepository {
    findById(turnId: string): Promise<StoredTurn | null>;
    findOpenBySessionId(sessionId: string): Promise<StoredTurn | null>;
    countBySessionId(sessionId: string): Promise<number>;
    findEventsForTurn(turnId: string): Promise<readonly string[]>;
    insert(input: TurnInsertInput): Promise<StoredTurn>;
    linkEvents(turnId: string, eventIds: readonly string[]): Promise<void>;
    closeTurn(turnId: string, assistantText: string, endedAt: string): Promise<void>;
    forceCloseTurn(turnId: string, endedAt: string): Promise<void>;
    updateAggregateVerdict(turnId: string, verdict: TurnAggregateVerdict): Promise<void>;
    updateRulesEvaluatedCount(turnId: string, count: number): Promise<void>;
}

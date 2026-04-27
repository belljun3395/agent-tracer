/**
 * Outbound port for turn (verification) read access. Self-contained.
 * Adapter wraps legacy TurnSummaryQueryPort until the verification module is split.
 */

export interface TurnSummaryAccessRecord {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId: string;
    readonly turnIndex: number;
    readonly status: string;
    readonly startedAt: string;
    readonly endedAt?: string | null;
    readonly aggregateVerdict?: string | null;
    readonly rulesEvaluatedCount?: number;
}

export interface ITurnQueryAccess {
    listTurnSummariesForTask(taskId: string): Promise<readonly TurnSummaryAccessRecord[]>;
}

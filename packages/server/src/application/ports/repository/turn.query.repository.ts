import type { TurnAggregateVerdict, TurnStatus } from "./turn.repository.js";
import type { VerdictStatus } from "~verification/domain/model/verdict.model.js";

/**
 * Legacy ITurnQueryRepository contract — self-contained.
 */

export interface BackfillTurnRow {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly status: TurnStatus;
    readonly assistantText: string;
    readonly userMessageText: string;
}

export interface TaskTurnSummaryRow {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: TurnStatus;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly aggregateVerdict: TurnAggregateVerdict;
    readonly rulesEvaluatedCount: number;
}

export interface ITurnQueryRepository {
    listAllTurnsForBackfill(): Promise<ReadonlyArray<BackfillTurnRow>>;
    listTurnsForTaskBackfill(taskId: string): Promise<ReadonlyArray<BackfillTurnRow>>;
    listTurnSummariesForTask(taskId: string): Promise<ReadonlyArray<TaskTurnSummaryRow>>;
    listVerdictStatusesForTask(taskId: string): Promise<readonly VerdictStatus[]>;
}

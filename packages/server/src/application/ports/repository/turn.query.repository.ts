import type { VerdictStatus } from "~domain/verification/index.js";

export interface BackfillTurnRow {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly status: "open" | "closed";
    readonly assistantText: string;
    readonly userMessageText: string;
}

export interface TaskTurnSummaryRow {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: "open" | "closed";
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly aggregateVerdict: "verified" | "unverifiable" | "contradicted" | null;
    readonly rulesEvaluatedCount: number;
}

export interface ITurnQueryRepository {
    listAllTurnsForBackfill(): Promise<ReadonlyArray<BackfillTurnRow>>;
    listTurnsForTaskBackfill(taskId: string): Promise<ReadonlyArray<BackfillTurnRow>>;
    listTurnSummariesForTask(taskId: string): Promise<ReadonlyArray<TaskTurnSummaryRow>>;
    listVerdictStatusesForTask(taskId: string): Promise<readonly VerdictStatus[]>;
}

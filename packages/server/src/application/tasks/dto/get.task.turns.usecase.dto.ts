export interface GetTaskTurnsUseCaseIn {
    readonly taskId: string;
}

export type TaskTurnStatusUseCaseDto = "open" | "closed";
export type TaskTurnAggregateVerdictUseCaseDto = "verified" | "unverifiable" | "contradicted";

export interface TaskTurnSummaryUseCaseDto {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: TaskTurnStatusUseCaseDto;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly aggregateVerdict: TaskTurnAggregateVerdictUseCaseDto | null;
    readonly rulesEvaluatedCount: number;
}

export interface GetTaskTurnsUseCaseOut {
    readonly turns: readonly TaskTurnSummaryUseCaseDto[];
}

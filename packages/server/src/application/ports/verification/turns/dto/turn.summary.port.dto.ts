import type { TurnAggregateVerdictPortDto, TurnStatusPortDto } from "./turn.record.port.dto.js";

export interface TaskTurnSummaryPortDto {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: TurnStatusPortDto;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly aggregateVerdict: TurnAggregateVerdictPortDto;
    readonly rulesEvaluatedCount: number;
}

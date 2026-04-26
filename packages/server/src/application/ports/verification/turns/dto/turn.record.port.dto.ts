export type TurnStatusPortDto = "open" | "closed";
export type TurnAggregateVerdictPortDto = "verified" | "unverifiable" | "contradicted" | null;

export interface TurnRecordPortDto {
    readonly id: string;
    readonly sessionId: string;
    readonly taskId: string;
    readonly turnIndex: number;
    readonly status: TurnStatusPortDto;
    readonly startedAt: string;
    readonly endedAt: string | null;
    readonly askedText: string | null;
    readonly assistantText: string | null;
    readonly aggregateVerdict: TurnAggregateVerdictPortDto;
    readonly rulesEvaluatedCount: number;
}

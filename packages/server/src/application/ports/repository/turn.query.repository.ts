import type {
    BackfillTurnPortDto,
    TaskTurnSummaryPortDto,
    TurnBackfillSourcePort,
    TurnSummaryQueryPort,
    VerdictStatusQueryPort,
} from "../verification/index.js";

export type BackfillTurnRow = BackfillTurnPortDto;
export type TaskTurnSummaryRow = TaskTurnSummaryPortDto;

export interface ITurnQueryRepository
    extends TurnBackfillSourcePort, TurnSummaryQueryPort, VerdictStatusQueryPort {}

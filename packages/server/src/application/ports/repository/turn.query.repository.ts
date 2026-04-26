import type { BackfillTurnPortDto } from "~application/ports/verification/turns/dto/turn.backfill.port.dto.js";
import type { TaskTurnSummaryPortDto } from "~application/ports/verification/turns/dto/turn.summary.port.dto.js";
import type { TurnBackfillSourcePort } from "~application/ports/verification/turns/turn.backfill.source.port.js";
import type { TurnSummaryQueryPort } from "~application/ports/verification/turns/turn.summary.query.port.js";
import type { VerdictStatusQueryPort } from "~application/ports/verification/verdicts/verdict.status.query.port.js";

export type BackfillTurnRow = BackfillTurnPortDto;
export type TaskTurnSummaryRow = TaskTurnSummaryPortDto;

export interface ITurnQueryRepository
    extends TurnBackfillSourcePort, TurnSummaryQueryPort, VerdictStatusQueryPort {}

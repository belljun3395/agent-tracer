import { Inject, Injectable } from "@nestjs/common";
import type { TurnSummaryQueryPort } from "~application/ports/verification/turns/turn.summary.query.port.js";
import { TURN_QUERY_REPOSITORY_TOKEN } from "~main/presentation/database/database.provider.js";
import type {
    ITurnQueryAccess,
    TurnSummaryAccessRecord,
} from "../application/outbound/turn.query.access.port.js";

/**
 * Outbound adapter — bridges legacy TurnSummaryQueryPort to the task-local
 * ITurnQueryAccess port. Retarget to verification module's public iservice
 * when that module is split out.
 */
@Injectable()
export class TurnQueryAccessAdapter implements ITurnQueryAccess {
    constructor(
        @Inject(TURN_QUERY_REPOSITORY_TOKEN) private readonly inner: TurnSummaryQueryPort,
    ) {}

    async listTurnSummariesForTask(taskId: string): Promise<readonly TurnSummaryAccessRecord[]> {
        const summaries = await this.inner.listTurnSummariesForTask(taskId);
        return summaries as unknown as readonly TurnSummaryAccessRecord[];
    }
}

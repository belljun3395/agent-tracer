import { Inject, Injectable } from "@nestjs/common";
import { TURN_QUERY_REPOSITORY_TOKEN } from "~governance/verification/public/tokens.js";
import type {
    ITurnQueryAccess,
    TurnSummaryAccessRecord,
} from "../application/outbound/turn.query.access.port.js";

/**
 * Structural shape consumed via TURN_QUERY_REPOSITORY_TOKEN. Self-contained so
 * task does not import verification's internal contracts.
 */
interface TurnSummaryQuerySource {
    listTurnSummariesForTask(taskId: string): Promise<readonly TurnSummaryAccessRecord[]>;
}

/**
 * Outbound adapter — bridges legacy TurnSummaryQueryPort to the task-local
 * ITurnQueryAccess port. Retarget to verification module's public iservice
 * when that module is split out.
 */
@Injectable()
export class TurnQueryAccessAdapter implements ITurnQueryAccess {
    constructor(
        @Inject(TURN_QUERY_REPOSITORY_TOKEN) private readonly inner: TurnSummaryQuerySource,
    ) {}

    async listTurnSummariesForTask(taskId: string): Promise<readonly TurnSummaryAccessRecord[]> {
        const summaries = await this.inner.listTurnSummariesForTask(taskId);
        return summaries as unknown as readonly TurnSummaryAccessRecord[];
    }
}

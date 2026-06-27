import { Inject, Injectable } from "@nestjs/common";
import { TURN_QUERY_REPOSITORY_TOKEN } from "../public/tokens.js";
import type {
    ITurnQueryAccess,
    TurnSummaryAccessRecord,
} from "../application/outbound/turn.query.access.port.js";

interface TurnSummaryQuerySource {
    listTurnSummariesForTask(taskId: string): Promise<readonly TurnSummaryAccessRecord[]>;
}

@Injectable()
export class TurnQueryAccessAdapter implements ITurnQueryAccess {
    constructor(
        @Inject(TURN_QUERY_REPOSITORY_TOKEN) private readonly inner: TurnSummaryQuerySource,
    ) {}

    listTurnSummariesForTask(taskId: string): Promise<readonly TurnSummaryAccessRecord[]> {
        return this.inner.listTurnSummariesForTask(taskId);
    }
}

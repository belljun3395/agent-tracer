import type { BackfillTurnPortDto } from "./dto/turn.backfill.port.dto.js";

export interface TurnBackfillSourcePort {
    listAllTurnsForBackfill(): Promise<ReadonlyArray<BackfillTurnPortDto>>;
    listTurnsForTaskBackfill(taskId: string): Promise<ReadonlyArray<BackfillTurnPortDto>>;
}

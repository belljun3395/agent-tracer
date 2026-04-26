import type { TaskTurnSummaryPortDto } from "./dto/turn.summary.port.dto.js";

export interface TurnSummaryQueryPort {
    listTurnSummariesForTask(taskId: string): Promise<ReadonlyArray<TaskTurnSummaryPortDto>>;
}

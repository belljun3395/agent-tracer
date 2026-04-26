import type { TaskStatusPortDto } from "./dto/task.record.port.dto.js";

export interface TaskOverviewQueryPort {
    listTaskStatuses(): Promise<readonly TaskStatusPortDto[]>;
    countTimelineEvents(): Promise<number>;
}

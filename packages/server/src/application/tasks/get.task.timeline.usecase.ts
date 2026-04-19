import { mapTimelineEventToRecord, type TimelineEventRecord } from "../views/index.js";
import type { IEventRepository } from "../ports/index.js";

export class GetTaskTimelineUseCase {
    constructor(private readonly eventRepo: IEventRepository) {}
    async execute(taskId: string): Promise<readonly TimelineEventRecord[]> {
        const timeline = await this.eventRepo.findByTaskId(taskId);
        return timeline.map(mapTimelineEventToRecord);
    }
}

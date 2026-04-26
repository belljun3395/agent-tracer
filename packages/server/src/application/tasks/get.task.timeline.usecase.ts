import { projectTimelineEvent } from "~application/events/timeline-event.projection.js";
import type { TimelineEventReadPort } from "../ports/index.js";
import type {
    GetTaskTimelineUseCaseIn,
    GetTaskTimelineUseCaseOut,
} from "./dto/get.task.timeline.usecase.dto.js";

export class GetTaskTimelineUseCase {
    constructor(private readonly eventRepo: TimelineEventReadPort) {}
    async execute(input: GetTaskTimelineUseCaseIn): Promise<GetTaskTimelineUseCaseOut> {
        const timeline = await this.eventRepo.findByTaskId(input.taskId);
        return { timeline: timeline.map(projectTimelineEvent) };
    }
}

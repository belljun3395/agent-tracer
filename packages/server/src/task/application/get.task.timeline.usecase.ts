import { Inject, Injectable } from "@nestjs/common";
import { projectTimelineEvent } from "~application/events/timeline-event.projection.js";
import { TIMELINE_EVENT_ACCESS_PORT } from "./outbound/tokens.js";
import type { ITimelineEventAccess } from "./outbound/timeline.event.access.port.js";
import type {
    GetTaskTimelineUseCaseIn,
    GetTaskTimelineUseCaseOut,
} from "./dto/get.task.timeline.usecase.dto.js";

@Injectable()
export class GetTaskTimelineUseCase {
    constructor(
        @Inject(TIMELINE_EVENT_ACCESS_PORT) private readonly events: ITimelineEventAccess,
    ) {}

    async execute(input: GetTaskTimelineUseCaseIn): Promise<GetTaskTimelineUseCaseOut> {
        const timeline = await this.events.findByTaskId(input.taskId);
        return { timeline: timeline.map((event) => projectTimelineEvent(event as never)) as never };
    }
}

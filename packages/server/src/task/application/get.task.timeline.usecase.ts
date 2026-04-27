import { Inject, Injectable } from "@nestjs/common";
import { EVENT_PROJECTION_ACCESS_PORT, TIMELINE_EVENT_ACCESS_PORT } from "./outbound/tokens.js";
import type { IEventProjectionAccess } from "./outbound/event.projection.access.port.js";
import type { ITimelineEventAccess } from "./outbound/timeline.event.access.port.js";
import type {
    GetTaskTimelineUseCaseIn,
    GetTaskTimelineUseCaseOut,
} from "./dto/get.task.timeline.usecase.dto.js";

@Injectable()
export class GetTaskTimelineUseCase {
    constructor(
        @Inject(TIMELINE_EVENT_ACCESS_PORT) private readonly events: ITimelineEventAccess,
        @Inject(EVENT_PROJECTION_ACCESS_PORT) private readonly projection: IEventProjectionAccess,
    ) {}

    async execute(input: GetTaskTimelineUseCaseIn): Promise<GetTaskTimelineUseCaseOut> {
        const timeline = await this.events.findByTaskId(input.taskId);
        return { timeline: timeline.map((event) => this.projection.project(event as never)) as never };
    }
}

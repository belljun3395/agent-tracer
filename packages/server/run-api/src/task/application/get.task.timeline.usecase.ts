import { Inject, Injectable } from "@nestjs/common";
import {
    TIMELINE_EVENT_PROJECTION,
    TIMELINE_EVENT_READ,
} from "@monitor/timeline-api/public/tokens.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/iservice/timeline.event.read.iservice.js";
import type { ITimelineEventProjection } from "@monitor/timeline-api/public/iservice/timeline.event.projection.iservice.js";
import type {
    GetTaskTimelineUseCaseIn,
    GetTaskTimelineUseCaseOut,
} from "./dto/get.task.timeline.usecase.dto.js";

@Injectable()
export class GetTaskTimelineUseCase {
    constructor(
        @Inject(TIMELINE_EVENT_READ) private readonly events: ITimelineEventRead,
        @Inject(TIMELINE_EVENT_PROJECTION) private readonly projection: ITimelineEventProjection,
    ) {}

    async execute(input: GetTaskTimelineUseCaseIn): Promise<GetTaskTimelineUseCaseOut> {
        const timeline = await this.events.findByTaskId(input.taskId);
        return { timeline: timeline.map((event) => this.projection.project(event)) };
    }
}

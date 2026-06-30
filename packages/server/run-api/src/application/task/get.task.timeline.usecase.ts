import { Inject, Injectable } from "@nestjs/common";
import {
    TIMELINE_EVENT_PROJECTION,
    TIMELINE_EVENT_READ,
} from "@monitor/timeline-api/public/event/tokens.js";
import type { ITimelineEventRead } from "@monitor/timeline-api/public/event/iservice/timeline.event.read.iservice.js";
import type { ITimelineEventProjection } from "@monitor/timeline-api/public/event/iservice/timeline.event.projection.iservice.js";
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

    // 여러 태스크의 타임라인을 한 번에 조회해 태스크별로 묶는다(배치 잡의 N+1 회피).
    async executeBatch(taskIds: readonly string[]): Promise<Map<string, GetTaskTimelineUseCaseOut["timeline"]>> {
        const byTask = new Map<string, GetTaskTimelineUseCaseOut["timeline"][number][]>();
        if (taskIds.length === 0) return byTask;
        const events = await this.events.findByTaskIds(taskIds);
        for (const event of events) {
            const list = byTask.get(event.taskId) ?? [];
            list.push(this.projection.project(event));
            byTask.set(event.taskId, list);
        }
        return byTask;
    }
}

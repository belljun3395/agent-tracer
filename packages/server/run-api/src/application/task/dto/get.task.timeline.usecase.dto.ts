import type { TimelineEventProjection } from "@monitor/timeline-api/public/dto/timeline.event.dto.js";

export interface GetTaskTimelineUseCaseIn {
    readonly taskId: string;
}

export type TimelineEventUseCaseDto = TimelineEventProjection;

export interface GetTaskTimelineUseCaseOut {
    readonly timeline: readonly TimelineEventUseCaseDto[];
}

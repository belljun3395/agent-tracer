import type { TimelineEventProjection } from "~application/events/timeline-event.projection.js";

export interface GetTaskTimelineUseCaseIn {
    readonly taskId: string;
}

export type TimelineEventUseCaseDto = TimelineEventProjection;

export interface GetTaskTimelineUseCaseOut {
    readonly timeline: readonly TimelineEventUseCaseDto[];
}

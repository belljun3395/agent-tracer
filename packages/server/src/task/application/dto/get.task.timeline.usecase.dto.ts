import type { ProjectedTimelineEvent } from "../outbound/event.projection.access.port.js";

export interface GetTaskTimelineUseCaseIn {
    readonly taskId: string;
}

export type TimelineEventUseCaseDto = ProjectedTimelineEvent;

export interface GetTaskTimelineUseCaseOut {
    readonly timeline: readonly TimelineEventUseCaseDto[];
}

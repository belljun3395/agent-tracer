import type { TimelineEventProjection } from "~application/events/timeline-event.projection.js";

export interface UpdateEventUseCaseIn {
    readonly eventId: string;
    readonly displayTitle?: string | null;
}

export type UpdateEventRecordUseCaseDto = TimelineEventProjection;

export type UpdateEventUseCaseOut = UpdateEventRecordUseCaseDto | null;

import type { TimelineEventProjection } from "@monitor/timeline-api/public/dto/timeline.event.dto.js";

export interface UpdateEventUseCaseIn {
    readonly eventId: string;
    readonly displayTitle?: string | null;
}

export type UpdateEventUseCaseOut = TimelineEventProjection | null;

/**
 * Outbound port — verification module's read access to timeline events.
 * Bound at runtime to event module's ITimelineEventRead via TIMELINE_EVENT_READ.
 * The factory in verification.module.ts casts the inner `TimelineEventSnapshot`
 * to TimelineEvent — verification code reads only the shared domain shape.
 */
import type { TimelineEvent } from "~event/domain/model/timeline.event.model.js";

export interface ITimelineEventAccess {
    findById(id: string): Promise<TimelineEvent | null>;
}

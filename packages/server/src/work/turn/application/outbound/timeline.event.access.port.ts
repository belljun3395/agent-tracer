/**
 * Outbound port — read timeline events for a task to derive turn segments.
 */
import type { TimelineEvent } from "~activity/event/public/types/event.types.js";

export type TimelineEventAccessRecord = TimelineEvent;

export interface ITimelineEventAccess {
    findByTaskId(taskId: string): Promise<readonly TimelineEventAccessRecord[]>;
}

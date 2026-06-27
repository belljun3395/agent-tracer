import type { MonitoringEventKind, TimelineLane } from "@monitor/activity/event/domain/common/const/event.kind.const.js";
import type { TimelineEventClassification, TimelineEventSnapshot } from "../dto/timeline.event.dto.js";

export interface TimelineEventWriteInput {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: TimelineEventClassification;
    readonly createdAt: string;
}

/**
 * Public iservice — write access to timeline events.
 * Consumed by other modules (e.g. task) that need to insert lifecycle events.
 * Calls go through the event module's TypeORM storage + FTS refresh + event-store
 * append, so all writers see the same atomic side effects.
 */
export interface ITimelineEventWrite {
    insert(input: TimelineEventWriteInput): Promise<TimelineEventSnapshot>;
}

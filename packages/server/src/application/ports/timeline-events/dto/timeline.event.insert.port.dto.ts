import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/common/type/event.kind.type.js";
import type { EventClassification, TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";

export interface TimelineEventInsertPortDto {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: TimelineEvent["sessionId"];
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: EventClassification;
    readonly createdAt: string;
}

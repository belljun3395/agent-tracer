import type {
    EventClassification,
    MonitoringEventKind,
    TimelineEvent,
    TimelineLane,
} from "~domain/monitoring/index.js";

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

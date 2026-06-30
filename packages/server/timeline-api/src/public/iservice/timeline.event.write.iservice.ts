import type { MonitoringEventKind, TimelineLane } from "@monitor/timeline-api/domain/common/const/event.kind.const.js";
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

export interface ITimelineEventWrite {
    insert(input: TimelineEventWriteInput): Promise<TimelineEventSnapshot>;
}

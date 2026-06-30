import type { MonitoringEventKind, TimelineLane } from "@monitor/timeline-api/domain/event/common/const/event.kind.const.js";
import type { EventClassificationMatch } from "@monitor/timeline-api/domain/event/type/timeline.event.type.js";

export interface TimelineEventInsertRequest {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: {
        readonly lane: TimelineLane;
        readonly tags: readonly string[];
        readonly matches: readonly EventClassificationMatch[];
    };
    readonly createdAt: string;
}

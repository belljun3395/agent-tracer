import type { MonitoringEventKind, TimelineLane } from "@monitor/timeline-api/domain/event/common/const/event.kind.const.js";
import type { EventClassificationMatch } from "@monitor/timeline-api/domain/event/type/timeline.event.type.js";

export interface TimelineEventClassification {
    readonly lane: TimelineLane;
    readonly tags: readonly string[];
    readonly matches: readonly EventClassificationMatch[];
}

export interface TimelineEventSnapshot {
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

export interface TimelineEventProjection {
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
    readonly semantic?: {
        readonly subtypeKey: string;
        readonly subtypeLabel: string;
        readonly subtypeGroup?: string;
        readonly entityType?: string;
        readonly entityName?: string;
    };
    readonly paths: {
        readonly primaryPath?: string;
        readonly filePaths: readonly string[];
        readonly mentionedPaths: readonly string[];
    };
}

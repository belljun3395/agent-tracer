import type { MonitoringEventKind, TimelineLane } from "@monitor/activity-api/event/domain/common/const/event.kind.const.js";
import type { EventClassificationMatch } from "@monitor/activity-api/event/domain/model/timeline.event.model.js";

/**
 * Snapshot DTO for a timeline event as exposed to other modules.
 * Mirrors the internal TimelineEvent shape — kept here so consumers depend
 * on event.public, not on @monitor/activity-api/event/domain/* internals.
 */
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

/** Wire-format projection of a timeline event (used in WS / SSE notifications). */
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

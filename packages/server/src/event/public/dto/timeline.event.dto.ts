import type { MonitoringEventKind, TimelineLane } from "~event/domain/common/type/event.kind.type.js";

/**
 * Snapshot DTO for a timeline event as exposed to other modules.
 * Mirrors the internal TimelineEvent shape — kept here so consumers depend
 * on event.public, not on ~event/domain/* internals.
 */
export interface TimelineEventClassification {
    readonly lane: TimelineLane;
    readonly tags: readonly string[];
    readonly matches: readonly unknown[];
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

import type { MonitoringEventKind, TimelineLane } from "@monitor/timeline-api/event/domain/common/const/event.kind.const.js";
import type { EventRelationType } from "@monitor/timeline-api/event/domain/common/const/event.meta.const.js";
import type { EventClassification } from "./timeline.event.model.js";

export interface EventRecordingInput {
    readonly kind: MonitoringEventKind;
    readonly taskId: string;
    readonly sessionId?: string | undefined;
    readonly title?: string | undefined;
    readonly body?: string | undefined;
    readonly lane: TimelineLane;
    readonly filePaths?: readonly string[] | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
    readonly parentEventId?: string | undefined;
    readonly relatedEventIds?: readonly string[] | undefined;
    readonly relationType?: EventRelationType | undefined;
    readonly relationLabel?: string | undefined;
    readonly relationExplanation?: string | undefined;
    readonly createdAt?: string | undefined;
}

export interface EventRecordDraft {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: EventClassification;
    readonly createdAt: string;
}

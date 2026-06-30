import type {
    IngestEventKind,
    MonitoringEventKind,
    TimelineLane,
} from "@monitor/timeline-api/domain/event/common/const/event.kind.const.js";
import type { EventRelationType } from "@monitor/timeline-api/domain/event/common/const/event.meta.const.js";

// 도메인 어휘를 application 경계에서 노출해 api/스키마가 도메인 const를 직접 의존하지 않게 한다.
export {
    EVENT_LANES,
    INGEST_EVENT_KINDS,
    TOOL_ACTIVITY_EVENT_KINDS,
    WORKFLOW_EVENT_KINDS,
    CONVERSATION_EVENT_KINDS,
    COORDINATION_EVENT_KINDS,
    LIFECYCLE_EVENT_KINDS,
    TELEMETRY_EVENT_KINDS,
} from "@monitor/timeline-api/domain/event/common/const/event.kind.const.js";
export { EVENT_RELATION_TYPES } from "@monitor/timeline-api/domain/event/common/const/event.meta.const.js";

export type RecordedEventKind = MonitoringEventKind;

export type EventRecordingTaskStatusDto = "running" | "waiting" | "completed" | "errored";

export interface EventRecordingIn {
    readonly id: string;
    readonly kind: IngestEventKind;
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
    readonly taskEffects?: { readonly taskStatus?: EventRecordingTaskStatusDto | undefined } | undefined;
}

export interface EventRecordingOut {
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: RecordedEventKind }[];
}

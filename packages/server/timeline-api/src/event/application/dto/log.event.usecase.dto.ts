import type {
    IngestEventKind,
    MonitoringEventKind,
    TimelineLane,
} from "@monitor/timeline-api/event/domain/common/const/event.kind.const.js";
import type { EventRelationType } from "@monitor/timeline-api/event/domain/common/const/event.meta.const.js";

// 영속되는 내부 kind까지 포함한 로깅 결과 kind.
export type LoggedEventKind = MonitoringEventKind;

export type LogEventTaskStatusUseCaseDto = "running" | "waiting" | "completed" | "errored";

export interface LogEventUseCaseIn {
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
    readonly taskEffects?: { readonly taskStatus?: LogEventTaskStatusUseCaseDto | undefined } | undefined;
}

export interface LogEventUseCaseOut {
    readonly sessionId?: string;
    readonly events: readonly { readonly id: string; readonly kind: LoggedEventKind }[];
}

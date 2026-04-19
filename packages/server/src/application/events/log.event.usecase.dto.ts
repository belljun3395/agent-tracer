import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/event.kind.js";
import type { EventRelationType } from "~domain/monitoring/task.status.type.js";

export interface BaseIngestEventInput {
    readonly kind: MonitoringEventKind
    readonly taskId: string
    readonly sessionId?: string | undefined
    readonly title?: string | undefined
    readonly body?: string | undefined
    readonly lane: TimelineLane
    readonly filePaths?: readonly string[] | undefined
    readonly metadata?: Record<string, unknown> | undefined
    readonly parentEventId?: string | undefined
    readonly relatedEventIds?: readonly string[] | undefined
    readonly relationType?: EventRelationType | undefined
    readonly relationLabel?: string | undefined
    readonly relationExplanation?: string | undefined
    readonly createdAt?: string | undefined
    readonly taskEffects?: { readonly taskStatus?: string | undefined } | undefined
}

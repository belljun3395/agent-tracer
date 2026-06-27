import type { TimelineEventSnapshot } from "../dto/timeline.event.dto.js";
import type { TaskStatus } from "@monitor/shared/task/task.status.const.js";

/**
 * Domain event emitted by timeline after one or more events are recorded in a
 * single LogEvent call. Subscribers react downstream — `work` applies the
 * task-status effect, `rules` runs verification — so timeline depends on no one
 * (pure leaf). Emitted synchronously via `emitAsync` inside the recording
 * transaction: a throwing subscriber rolls the event insert back, preserving the
 * previous atomic semantics.
 */
export const EVENT_RECORDED = "timeline.event.recorded" as const;

export interface EventRecordedPayload {
    /** Primary event followed by any derived (e.g. file-change) events. */
    readonly events: readonly TimelineEventSnapshot[];
    readonly taskId: string;
    readonly sessionId?: string;
    /** Caller-declared task-status effect, applied by the `work` subscriber. */
    readonly taskEffects?: { readonly taskStatus?: TaskStatus };
}

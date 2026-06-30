import type { TimelineEventSnapshot } from "../dto/timeline.event.dto.js";
import type { TaskStatus } from "@monitor/shared/task/task.status.const.js";

export const EVENT_RECORDED = "timeline.event.recorded" as const;

export interface EventRecordedPayload {

    readonly events: readonly TimelineEventSnapshot[];
    readonly taskId: string;
    readonly sessionId?: string;

    readonly taskEffects?: { readonly taskStatus?: TaskStatus };
}

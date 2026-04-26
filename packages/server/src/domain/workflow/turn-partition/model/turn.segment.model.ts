import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";

export interface TurnSegment {
    readonly turnIndex: number;
    readonly isPrelude: boolean;
    readonly startAt: string;
    readonly endAt: string;
    readonly requestPreview: string | null;
    readonly events: readonly TimelineEvent[];
}

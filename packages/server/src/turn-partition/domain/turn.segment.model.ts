import type { TimelineEvent } from "~event/domain/model/timeline.event.model.js";

export interface TurnSegment {
    readonly turnIndex: number;
    readonly isPrelude: boolean;
    readonly startAt: string;
    readonly endAt: string;
    readonly requestPreview: string | null;
    readonly events: readonly TimelineEvent[];
}

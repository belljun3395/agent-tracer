import type { TimelineEvent } from "~event/public/types/event.types.js";

export interface TurnSegment {
    readonly turnIndex: number;
    readonly isPrelude: boolean;
    readonly startAt: string;
    readonly endAt: string;
    readonly requestPreview: string | null;
    readonly events: readonly TimelineEvent[];
}

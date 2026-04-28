import type { EventRelationType } from "~event/domain/common/type/event.meta.type.js";

export interface TimelineRelationEdge {
    readonly sourceEventId: string;
    readonly targetEventId: string;
    readonly relationType?: EventRelationType;
}

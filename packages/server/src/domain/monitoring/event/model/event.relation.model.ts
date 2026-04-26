import type { EventRelationType } from "~domain/monitoring/common/type/task.status.type.js";

export interface TimelineRelationEdge {
    readonly sourceEventId: string;
    readonly targetEventId: string;
    readonly relationType?: EventRelationType;
}

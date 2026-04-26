import { isEventRelationType } from "../common/task.status.js";
import { isFileChangedEvent } from "./event.predicates.js";
import { readString, readStringArray } from "./event.metadata.js";
import type { EventRelationType } from "../common/type/task.status.type.js";
import { TRACE_LINK_ELIGIBLE_KINDS } from "./const/event.relation.const.js";
import type { TimelineRelationEdge } from "./model/event.relation.model.js";
import type { TimelineEvent } from "./model/timeline.event.model.js";

export function collectExplicitRelations(timeline: readonly TimelineEvent[]): readonly TimelineRelationEdge[] {
    const eventIds = new Set<string>(timeline.map((event) => event.id));
    const seen = new Set<string>();
    const relations: TimelineRelationEdge[] = [];
    for (const event of timeline) {
        const parentEventId = readString(event.metadata, "parentEventId");
        if (parentEventId && eventIds.has(parentEventId)) {
            const relationType = extractRelationType(event.metadata);
            pushRelation(relations, seen, {
                sourceEventId: parentEventId,
                targetEventId: event.id,
                ...(relationType ? { relationType } : {}),
            });
        }
        const sourceEventId = readString(event.metadata, "sourceEventId");
        if (sourceEventId && eventIds.has(sourceEventId) && isFileChangedEvent(event)) {
            pushRelation(relations, seen, {
                sourceEventId,
                targetEventId: event.id,
                relationType: "caused_by",
            });
        }
        for (const relatedEventId of readStringArray(event.metadata, "relatedEventIds")) {
            if (!eventIds.has(relatedEventId)) continue;
            const relationType = extractRelationType(event.metadata);
            pushRelation(relations, seen, {
                sourceEventId: event.id,
                targetEventId: relatedEventId,
                ...(relationType ? { relationType } : {}),
            });
        }
    }
    return relations;
}

export function isTraceLinkEligible(event: TimelineEvent): boolean {
    return TRACE_LINK_ELIGIBLE_KINDS.has(event.kind);
}

function extractRelationType(metadata: Record<string, unknown>): EventRelationType | undefined {
    const relationType = readString(metadata, "relationType");
    if (!relationType || !isEventRelationType(relationType)) return undefined;
    return relationType;
}

function pushRelation(
    relations: TimelineRelationEdge[],
    seen: Set<string>,
    relation: TimelineRelationEdge,
): void {
    const key = `${relation.sourceEventId}→${relation.targetEventId}:${relation.relationType ?? "relates_to"}`;
    if (seen.has(key)) return;
    seen.add(key);
    relations.push(relation);
}

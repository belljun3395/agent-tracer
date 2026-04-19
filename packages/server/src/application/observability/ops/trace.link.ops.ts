import type { EventRelationType, TimelineEvent } from "~domain/index.js";
import { isEventRelationType, isFileChangedEvent, readString, readStringArray } from "~domain/index.js";

export interface TimelineRelationEdge {
    readonly sourceEventId: string;
    readonly targetEventId: string;
    readonly relationType?: EventRelationType;
}

export const TRACE_LINK_ELIGIBLE_KINDS: ReadonlySet<TimelineEvent["kind"]> = new Set([
    "plan.logged",
    "action.logged",
    "verification.logged",
    "rule.logged",
    "agent.activity.logged",
    "file.changed",
]);

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

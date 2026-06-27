
export class EventRelationEntity {
    eventId!: string;

    sourceEventId!: string;

    targetEventId!: string;

    edgeKind!: "parent" | "source" | "related";

    relationType!: string;

    relationLabel!: string | null;

    relationExplanation!: string | null;
}

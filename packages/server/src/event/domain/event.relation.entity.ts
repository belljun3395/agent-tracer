import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "event_relations" })
@Index("idx_event_relations_source", ["sourceEventId"])
@Index("idx_event_relations_target", ["targetEventId"])
export class EventRelationEntity {
    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;

    @PrimaryColumn({ name: "source_event_id", type: "text" })
    sourceEventId!: string;

    @PrimaryColumn({ name: "target_event_id", type: "text" })
    targetEventId!: string;

    @PrimaryColumn({ name: "edge_kind", type: "text" })
    edgeKind!: "parent" | "source" | "related";

    @PrimaryColumn({ name: "relation_type", type: "text", default: "relates_to" })
    relationType!: string;

    @Column({ name: "relation_label", type: "text", nullable: true })
    relationLabel!: string | null;

    @Column({ name: "relation_explanation", type: "text", nullable: true })
    relationExplanation!: string | null;
}

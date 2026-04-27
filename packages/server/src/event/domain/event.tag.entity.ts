import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "event_tags" })
@Index("idx_event_tags_tag", ["tag"])
export class EventTagEntity {
    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;

    @PrimaryColumn({ type: "text" })
    tag!: string;

    @Column({ type: "text", default: "metadata" })
    source!: "metadata" | "classification" | "multiple";
}

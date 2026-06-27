import { Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "turn_events" })
@Index("idx_turn_events_event", ["eventId"])
export class TurnEventEntity {
    @PrimaryColumn({ name: "turn_id", type: "text" })
    turnId!: string;

    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;
}

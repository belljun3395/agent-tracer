import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Event-store @Entity for the shared `events` table. Used by event module's
 * EventStoreService and by other modules' subscribers (each maps the same
 * table from its own `@Entity` class — TypeORM treats them independently so
 * each module owns its mapping).
 */
@Entity({ name: "events" })
export class EventLogEntity {
    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;

    @Column({ name: "event_time", type: "integer" })
    eventTime!: number;

    @Column({ name: "event_type", type: "text" })
    eventType!: string;

    @Column({ name: "schema_ver", type: "integer" })
    schemaVer!: number;

    @Column({ name: "aggregate_id", type: "text" })
    aggregateId!: string;

    @Column({ name: "session_id", type: "text", nullable: true })
    sessionId!: string | null;

    @Column({ type: "text" })
    actor!: string;

    @Column({ name: "correlation_id", type: "text", nullable: true })
    correlationId!: string | null;

    @Column({ name: "causation_id", type: "text", nullable: true })
    causationId!: string | null;

    @Column({ name: "payload_json", type: "text" })
    payloadJson!: string;

    @Column({ name: "recorded_at", type: "integer" })
    recordedAt!: number;
}

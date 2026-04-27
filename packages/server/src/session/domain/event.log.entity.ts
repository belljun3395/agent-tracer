import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * @Entity for the events log table - written by SessionEventSubscriber
 * when SessionEntity / RuntimeBindingEntity changes.
 *
 * NOTE: temporarily lives in the session module. Will move to a dedicated
 * event module when that split happens.
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

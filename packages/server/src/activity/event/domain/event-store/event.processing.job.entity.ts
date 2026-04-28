import { Column, Entity, Index, PrimaryColumn } from "typeorm";

/**
 * Outbox entry for asynchronous post-processing of a logged timeline event.
 * One row per pending job; the worker claims rows by updating status from
 * `pending` → `processing` atomically. Survives crashes (durable in DB).
 */
@Entity({ name: "event_processing_jobs" })
@Index("idx_event_processing_jobs_status_created", ["status", "createdAt"])
export class EventProcessingJobEntity {
    @PrimaryColumn({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ name: "event_id", type: "text" })
    eventId!: string;

    @Column({ name: "job_type", type: "text" })
    jobType!: string;

    @Column({ type: "text" })
    status!: "pending" | "processing" | "completed" | "failed";

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;

    @Column({ name: "last_error", type: "text", nullable: true })
    lastError!: string | null;
}

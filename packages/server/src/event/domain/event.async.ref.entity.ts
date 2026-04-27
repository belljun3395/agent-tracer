import { Column, Entity, Index, PrimaryColumn } from "typeorm";

@Entity({ name: "event_async_refs" })
@Index("idx_event_async_refs_task", ["asyncTaskId"])
export class EventAsyncRefEntity {
    @PrimaryColumn({ name: "event_id", type: "text" })
    eventId!: string;

    @Column({ name: "async_task_id", type: "text" })
    asyncTaskId!: string;

    @Column({ name: "async_status", type: "text", nullable: true })
    asyncStatus!: string | null;

    @Column({ name: "async_agent", type: "text", nullable: true })
    asyncAgent!: string | null;

    @Column({ name: "async_category", type: "text", nullable: true })
    asyncCategory!: string | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;
}

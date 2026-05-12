import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RecipeScanJobStatus =
    | "pending"
    | "processing"
    | "completed"
    | "failed";

@Entity({ name: "recipe_scan_jobs" })
@Index("idx_recipe_scan_jobs_status", ["status", "createdAt"])
export class RecipeScanJobEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ type: "text" })
    status!: RecipeScanJobStatus;

    @Column({ type: "integer", default: 0 })
    attempts!: number;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "candidates_created", type: "integer", default: 0 })
    candidatesCreated!: number;

    @Column({ name: "tasks_scanned", type: "integer", default: 0 })
    tasksScanned!: number;

    /** JSON snapshot of the filters supplied when the scan was enqueued. */
    @Column({ name: "filters_json", type: "text", default: "{}" })
    filtersJson!: string;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    @Column({ name: "model_used", type: "text", nullable: true })
    modelUsed!: string | null;

    @Column({ name: "duration_ms", type: "integer", nullable: true })
    durationMs!: number | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;

    @Column({ name: "started_at", type: "text", nullable: true })
    startedAt!: string | null;

    @Column({ name: "completed_at", type: "text", nullable: true })
    completedAt!: string | null;
}

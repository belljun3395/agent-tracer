import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RecipeCandidateStatus =
    | "pending"
    | "accepted"
    | "dismissed"
    | "failed";

@Entity({ name: "recipe_candidates" })
@Index("idx_recipe_candidates_user_status", ["userId", "status", "createdAt"])
@Index("idx_recipe_candidates_job", ["jobId"])
export class RecipeCandidateEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

    @Column({ name: "job_id", type: "text" })
    jobId!: string;

    @Column({ type: "text" })
    title!: string;

    @Column({ type: "text" })
    intent!: string;

    @Column({ type: "text" })
    description!: string;

    @Column({ name: "summary_md", type: "text" })
    summaryMd!: string;

    @Column({ name: "steps_json", type: "text", default: "[]" })
    stepsJson!: string;

    @Column({ name: "touched_files_json", type: "text", default: "[]" })
    touchedFilesJson!: string;

    @Column({ name: "contributing_slices_json", type: "text" })
    contributingSlicesJson!: string;

    @Column({ type: "text" })
    rationale!: string;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    @Column({ name: "parent_recipe_id", type: "text", nullable: true })
    parentRecipeId!: string | null;

    @Column({ type: "text" })
    status!: RecipeCandidateStatus;

    @Column({ type: "text", nullable: true })
    error!: string | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "resolved_at", type: "text", nullable: true })
    resolvedAt!: string | null;

    isPending(): boolean {
        return this.status === "pending";
    }

    isResolved(): boolean {
        return this.status !== "pending";
    }
}

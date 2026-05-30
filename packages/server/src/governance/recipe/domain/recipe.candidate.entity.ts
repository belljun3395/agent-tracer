import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RecipeCandidateStatus =
    | "pending"
    | "accepted"
    | "dismissed"
    | "failed";

@Entity({ name: "recipe_candidates" })
@Index("idx_recipe_candidates_status", ["status", "createdAt"])
@Index("idx_recipe_candidates_job", ["jobId"])
export class RecipeCandidateEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

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

    /** JSON array of {order, action, rationale?}. */
    @Column({ name: "steps_json", type: "text", default: "[]" })
    stepsJson!: string;

    /** JSON array of {path, role: 'read'|'write'|'both'}. */
    @Column({ name: "touched_files_json", type: "text", default: "[]" })
    touchedFilesJson!: string;

    /**
     * JSON array of {taskId, eventIds: string[]}. `eventIds: []` means
     * "whole task" — the slice spans every event in that task.
     */
    @Column({ name: "contributing_slices_json", type: "text" })
    contributingSlicesJson!: string;

    @Column({ type: "text" })
    rationale!: string;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    /**
     * If this candidate is a re-write of an existing active recipe, the
     * parent's id. Surface as a "compare" card during review.
     */
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

    /** Awaiting a human decision — the only state from which it can be accepted/dismissed. */
    isPending(): boolean {
        return this.status === "pending";
    }

    /** Reached a terminal state (accepted / dismissed / failed). */
    isResolved(): boolean {
        return this.status !== "pending";
    }
}

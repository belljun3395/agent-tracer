import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RecipeStatus = "active" | "superseded" | "retired";

/** Auto-retirement policy thresholds (pure domain constants). */
const MIN_APPLIED_FOR_FAILURE = 5;
const MIN_SUCCESS_RATE = 0.3;
const STALE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

@Entity({ name: "recipes_current" })
@Index("idx_recipes_current_status", ["status", "updatedAt"])
export class RecipeEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "source_candidate_id", type: "text", nullable: true })
    sourceCandidateId!: string | null;

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

    @Column({ type: "integer", default: 1 })
    rev!: number;

    @Column({ name: "parent_recipe_id", type: "text", nullable: true })
    parentRecipeId!: string | null;

    @Column({ type: "text" })
    status!: RecipeStatus;

    @Column({ name: "applied_count", type: "integer", default: 0 })
    appliedCount!: number;

    @Column({ name: "success_count", type: "integer", default: 0 })
    successCount!: number;

    @Column({ type: "text", nullable: true })
    language!: string | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "updated_at", type: "text" })
    updatedAt!: string;

    /** Success ratio in [0, 1]; 0 when the recipe has never been applied. */
    successRate(): number {
        return this.appliedCount > 0 ? this.successCount / this.appliedCount : 0;
    }

    /**
     * Auto-retirement policy. An active recipe should be retired when it
     * either fails too often (applied >= 5 times with a success rate below
     * 30%) or has gone stale (never applied and older than 14 days).
     * Non-active recipes are never retired by this policy.
     */
    shouldRetire(nowIso: string): boolean {
        if (this.status !== "active") return false;
        const ageMs = Date.parse(nowIso) - Date.parse(this.createdAt);
        const failsByFailure =
            this.appliedCount >= MIN_APPLIED_FOR_FAILURE &&
            this.successRate() < MIN_SUCCESS_RATE;
        const failsByStaleness = this.appliedCount === 0 && ageMs > STALE_AGE_MS;
        return failsByFailure || failsByStaleness;
    }
}

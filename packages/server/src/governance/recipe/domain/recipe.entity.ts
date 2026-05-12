import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RecipeStatus = "active" | "superseded" | "retired";

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
}

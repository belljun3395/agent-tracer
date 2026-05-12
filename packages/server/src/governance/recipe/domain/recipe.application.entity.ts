import { Column, Entity, Index, PrimaryColumn } from "typeorm";

export type RecipeApplicationInjectedVia =
    | "auto"
    | "slash_command"
    | "manual";

export type RecipeApplicationOutcome =
    | "completed"
    | "abandoned"
    | "superseded";

@Entity({ name: "recipe_applications" })
@Index("idx_recipe_applications_recipe", ["recipeId", "createdAt"])
@Index("idx_recipe_applications_task", ["targetTaskId", "createdAt"])
export class RecipeApplicationEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "recipe_id", type: "text" })
    recipeId!: string;

    @Column({ name: "target_task_id", type: "text" })
    targetTaskId!: string;

    @Column({ name: "injected_via", type: "text" })
    injectedVia!: RecipeApplicationInjectedVia;

    @Column({ type: "real", nullable: true })
    score!: number | null;

    @Column({ type: "text", nullable: true })
    outcome!: RecipeApplicationOutcome | null;

    @Column({ name: "created_at", type: "text" })
    createdAt!: string;

    @Column({ name: "resolved_at", type: "text", nullable: true })
    resolvedAt!: string | null;
}

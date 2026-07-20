import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { RecipeInjectedVia, RecipeOutcome } from "@monitor/kernel";

@Entity({ name: "recipe_applications" })
@Index("recipe_applications_recipe", ["recipeId", "createdAt"])
@Index("recipe_applications_task", ["taskId"])
export class RecipeApplicationEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text" })
    userId!: string;

    @Column({ name: "recipe_id", type: "text" })
    recipeId!: string;

    @Column({ name: "task_id", type: "text" })
    taskId!: string;

    @Column({ name: "injected_via", type: "text" })
    injectedVia!: RecipeInjectedVia;

    @Column({ type: "text", nullable: true })
    outcome!: RecipeOutcome | null;

    @Column({ type: "text", nullable: true })
    note!: string | null;

    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date;

    @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
    resolvedAt!: Date | null;

    resolve(outcome: RecipeOutcome, at: Date): void {
        this.outcome = outcome;
        this.resolvedAt = at;
    }

    isResolved(): boolean {
        return this.outcome !== null;
    }
}

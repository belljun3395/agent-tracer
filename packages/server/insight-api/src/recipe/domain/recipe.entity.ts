import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import { RECIPE_STATUS } from "./const/recipe.const.js";
import type { RecipeStatus } from "./const/recipe.const.js";

const MIN_APPLIED_FOR_FAILURE = 5;
const MIN_SUCCESS_RATE = 0.3;
const STALE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

@Entity({ name: "recipes" })
@Index("idx_recipes_user_status", ["userId", "status", "updatedAt"])
export class RecipeEntity {
    @PrimaryColumn({ type: "text" })
    id!: string;

    @Column({ name: "user_id", type: "text", default: "local" })
    userId!: string;

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

    successRate(): number {
        return this.appliedCount > 0 ? this.successCount / this.appliedCount : 0;
    }

    isRetired(): boolean {
        return this.status === RECIPE_STATUS.retired;
    }

    shouldRetire(nowIso: string): boolean {
        // active 레시피만 자동 폐기 대상이며, 이미 superseded/retired인 항목은 건드리지 않는다.
        if (this.status !== RECIPE_STATUS.active) return false;
        const ageMs = Date.parse(nowIso) - Date.parse(this.createdAt);
        // 충분히 적용됐는데 성공률이 낮거나, 한 번도 쓰이지 않은 채 오래된 레시피를 폐기한다.
        const failsByFailure =
            this.appliedCount >= MIN_APPLIED_FOR_FAILURE &&
            this.successRate() < MIN_SUCCESS_RATE;
        const failsByStaleness = this.appliedCount === 0 && ageMs > STALE_AGE_MS;
        return failsByFailure || failsByStaleness;
    }
}

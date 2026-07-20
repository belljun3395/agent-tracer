import { RECIPE_OUTCOME } from "@monitor/kernel";
import type { RecipeEntity } from "./recipe.entity.js";
import type { RecipeApplicationEntity } from "./application/recipe.application.entity.js";
import type { RecipeStats } from "./recipe.types.js";

/** 레시피와 적용 이력을 합쳐 사용량과 자기보고 성과를 집계한다. */
export class RecipeLifecycle {
    constructor(
        private readonly recipe: RecipeEntity,
        private readonly applications: readonly RecipeApplicationEntity[],
    ) {}

    /** applicationCount는 자기보고 여부와 무관한 적용 행 총 수이고, decidedCount는 그중 자기보고가 붙은 수다. */
    stats(): RecipeStats {
        const decided = this.applications.filter((a) => a.outcome !== null);
        const succeeded = decided.filter((a) => a.outcome === RECIPE_OUTCOME.completed);
        return {
            applicationCount: this.applications.length,
            decidedCount: decided.length,
            successRate: decided.length > 0 ? succeeded.length / decided.length : 0,
        };
    }

    shouldRetire(now: Date): boolean {
        return this.recipe.shouldRetire(now, this.stats());
    }
}

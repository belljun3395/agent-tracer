import { COMPLETED_TASK_STATUS, ERRORED_TASK_STATUS, RECIPE_OUTCOME, type TaskStatus } from "@monitor/kernel";
import type { RecipeEntity } from "./recipe.entity.js";
import type { RecipeApplicationEntity } from "./application/recipe.application.entity.js";
import type { RecipeStats } from "./recipe.types.js";

/** 레시피와 적용 이력을 합쳐 성과를 집계하고 미해결 이력을 판정한다. */
export class RecipeLifecycle {
    constructor(
        private readonly recipe: RecipeEntity,
        private readonly applications: readonly RecipeApplicationEntity[],
    ) {}

    stats(): RecipeStats {
        const applied = this.applications.length;
        const success = this.applications.filter((a) => a.outcome === RECIPE_OUTCOME.completed).length;
        return { applied, success, successRate: applied > 0 ? success / applied : 0 };
    }

    shouldRetire(now: Date): boolean {
        return this.recipe.shouldRetire(now, this.stats());
    }

    /** 종료된 작업의 미해결 적용 이력에 결과를 부여하고 바뀐 이력만 반환한다. */
    resolveOutcomes(taskStatus: TaskStatus, taskId: string, now: Date): RecipeApplicationEntity[] {
        const outcome = taskStatus === COMPLETED_TASK_STATUS
            ? RECIPE_OUTCOME.completed
            : taskStatus === ERRORED_TASK_STATUS
                ? RECIPE_OUTCOME.abandoned
                : null;
        if (outcome === null) return [];
        const changed: RecipeApplicationEntity[] = [];
        for (const application of this.applications) {
            if (application.taskId !== taskId || application.isResolved()) continue;
            application.resolve(outcome, now);
            changed.push(application);
        }
        return changed;
    }
}

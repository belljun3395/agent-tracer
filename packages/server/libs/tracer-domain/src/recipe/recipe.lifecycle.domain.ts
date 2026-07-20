import {
    COMPLETED_TASK_STATUS,
    ERRORED_TASK_STATUS,
    RECIPE_VERDICT,
    type RecipeStepDto,
    type TaskStatus,
} from "@monitor/kernel";
import type { RecipeEntity } from "./recipe.entity.js";
import type { RecipeApplicationEntity } from "./application/recipe.application.entity.js";
import type { RecipeStats } from "./recipe.types.js";
import { evaluateRecipeCompliance, type RecipeVerifyWindowEvent } from "./model/recipe.compliance.model.js";
import { composeRecipeVerdict } from "./model/recipe.verdict.model.js";

/** 레시피와 적용 이력을 합쳐 성과를 집계하고 미해결 적용의 판정을 전진시킨다. */
export class RecipeLifecycle {
    constructor(
        private readonly recipe: RecipeEntity,
        private readonly applications: readonly RecipeApplicationEntity[],
    ) {}

    /** applicationCount는 판정과 무관한 적용 행 총 수이고, unknown은 관측 실패이지 성과가 아니므로 successRate의 분모에서 뺀다. */
    stats(): RecipeStats {
        const verdicts = {
            followedAndHelped: this.applications.filter((a) => a.verdict === RECIPE_VERDICT.followedAndHelped).length,
            followedNotHelped: this.applications.filter((a) => a.verdict === RECIPE_VERDICT.followedNotHelped).length,
            abandoned: this.applications.filter((a) => a.verdict === RECIPE_VERDICT.abandoned).length,
            unknown: this.applications.filter((a) => a.verdict === RECIPE_VERDICT.unknown).length,
        };
        const decidedCount = verdicts.followedAndHelped + verdicts.followedNotHelped + verdicts.abandoned;
        return {
            applicationCount: this.applications.length,
            decidedCount,
            successRate: decidedCount > 0 ? verdicts.followedAndHelped / decidedCount : 0,
            verdicts,
        };
    }

    shouldRetire(now: Date): boolean {
        return this.recipe.shouldRetire(now, this.stats());
    }

    /** 종료된 작업의 미해결 적용마다 창 이벤트로 이행을 관측해 판정을 종결하고, 바뀐 이력만 반환한다. */
    resolveVerdicts(
        taskStatus: TaskStatus,
        taskId: string,
        windowEventsByApplicationId: ReadonlyMap<string, readonly RecipeVerifyWindowEvent[]>,
        now: Date,
    ): RecipeApplicationEntity[] {
        if (taskStatus !== COMPLETED_TASK_STATUS && taskStatus !== ERRORED_TASK_STATUS) return [];
        const steps = this.recipe.steps as readonly RecipeStepDto[];
        const changed: RecipeApplicationEntity[] = [];
        for (const application of this.applications) {
            if (application.taskId !== taskId || application.isVerdictResolved()) continue;
            const windowEvents = windowEventsByApplicationId.get(application.id) ?? [];
            const compliance = evaluateRecipeCompliance(steps, windowEvents);
            const { verdict, evidence } = composeRecipeVerdict(compliance, taskStatus, application.outcome);
            application.resolveVerdict(verdict, evidence, now);
            changed.push(application);
        }
        return changed;
    }
}

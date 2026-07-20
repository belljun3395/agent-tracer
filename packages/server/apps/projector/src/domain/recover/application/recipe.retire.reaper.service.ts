import { Inject, Injectable } from "@nestjs/common";
import { RECIPE_STALE_AGE_MS, RecipeLifecycle } from "@monitor/tracer-domain";
import { ADVISORY_LOCK_KEY } from "~projector/domain/recover/port/advisory.lock.keys.js";
import {
    ADVISORY_LOCK,
    type AdvisoryLockPort,
} from "~projector/domain/recover/port/advisory.lock.port.js";
import type { RecipeRetireReaperRepositories } from "~projector/domain/recover/port/recipe.retire.reaper.repository.port.js";
import { logError, logInfo } from "~projector/support/log.js";

const REAP_BATCH = 200;

/** 태스크 종결에 얹을 수 없는 노후 갈래(한 번도 당겨진 적 없음)만 주기적으로 은퇴시킨다. */
@Injectable()
export class RecipeRetireReaperService {
    constructor(@Inject(ADVISORY_LOCK) private readonly lock: AdvisoryLockPort<RecipeRetireReaperRepositories>) {}

    async runOnce(now: Date): Promise<number> {
        const before = new Date(now.getTime() - RECIPE_STALE_AGE_MS);
        try {
            const retired = await this.lock.withAdvisoryLock(ADVISORY_LOCK_KEY.recipeRetireReaper, async (repositories) => {
                const candidates = await repositories.recipes.findStaleActiveCandidates(before, REAP_BATCH);
                let count = 0;
                for (const recipe of candidates) {
                    const applications = await repositories.recipeApplications.findByRecipe(recipe.id);
                    if (!new RecipeLifecycle(recipe, applications).shouldRetire(now)) continue;
                    recipe.retire(now);
                    await repositories.recipes.upsert(recipe);
                    count += 1;
                }
                return count;
            });
            if (retired === null || retired === 0) return 0;
            logInfo({ msg: "recipe-retire-reaper.retired", count: retired });
            return retired;
        } catch (error) {
            logError({
                msg: "recipe-retire-reaper.error",
                error: error instanceof Error ? error.message : String(error),
            });
            return 0;
        }
    }
}

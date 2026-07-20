import {formatRecipeNudge} from "~runtime/domain/recipe/model/recipe.nudge.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

/** 캐시된 레시피 개수로 넛지 문구를 만들며, 관련성 판단은 search_recipes를 부르는 에이전트에게 넘긴다. */
export class BuildRecipeNudgeUsecase {
    constructor(private readonly cache: RecipeCachePort) {}

    execute(): string {
        return formatRecipeNudge(this.cache.load().length);
    }
}

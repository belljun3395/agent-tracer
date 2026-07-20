import {buildRecipeMenu} from "~runtime/domain/recipe/model/recipe.menu.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

/** 캐시의 활성 레시피 전부로 메뉴 텍스트를 만들며, 프롬프트와의 관련성 판단은 에이전트에게 넘긴다. */
export class BuildRecipeMenuUsecase {
    constructor(private readonly cache: RecipeCachePort) {}

    execute(): string {
        return buildRecipeMenu(this.cache.load());
    }
}

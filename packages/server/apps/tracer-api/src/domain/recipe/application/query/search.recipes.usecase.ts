import { Inject, Injectable } from "@nestjs/common";
import { clampSearchLimit, type SearchLimitBounds } from "~tracer-api/support/search.limit.js";
import { RECIPE_SEARCH, type RecipeSearchHit, type RecipeSearchPort } from "~tracer-api/domain/recipe/port/recipe.search.port.js";

export interface SearchRecipesInput {
    readonly userId: string;
    readonly q: string;
    readonly limit?: number;
}

/** 모델이 판단할 수 있게 결정 수준의 정보만 내고, 단계·주의점·수정 이력은 get_recipe로 미룬다. */
export interface RecipeSearchResultItem {
    readonly recipeId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly score: number;
}

const SEARCH_LIMIT_BOUNDS: SearchLimitBounds = { default: 3, max: 10 };

@Injectable()
export class SearchRecipesUseCase {
    constructor(@Inject(RECIPE_SEARCH) private readonly search: RecipeSearchPort) {}

    async execute(input: SearchRecipesInput): Promise<{ readonly items: readonly RecipeSearchResultItem[] }> {
        const q = input.q.trim();
        if (q.length === 0) return { items: [] };
        const limit = clampSearchLimit(input.limit, SEARCH_LIMIT_BOUNDS);
        const hits = await this.search.search(input.userId, q, limit);
        return { items: hits.map(toItem) };
    }
}

function toItem(hit: RecipeSearchHit): RecipeSearchResultItem {
    return { recipeId: hit.id, title: hit.title, intent: hit.intent, description: hit.description, score: hit.score };
}

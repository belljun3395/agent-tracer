import {formatRecipeContext, matchRecipes, type RecipeMatch} from "~runtime/domain/recipe/model/recipe.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";

/** 프롬프트 앞에 주입할 레시피 컨텍스트와 그 주입 사실을 보고할 근거다. */
export interface RecipeContext {
    readonly matches: readonly RecipeMatch[];
    readonly context: string;
    readonly titles: readonly string[];
    readonly bytes: number;
}

/** 캐시된 레시피를 프롬프트와 매칭해 주입 텍스트를 만든다. */
export class BuildRecipeContextUsecase {
    constructor(private readonly cache: RecipeCachePort) {}

    execute(prompt: string, limit?: number): RecipeContext {
        const matches = matchRecipes(prompt, this.cache.load(), limit);
        const context = formatRecipeContext(matches);
        return {
            matches,
            context,
            titles: matches.map((match) => match.title),
            bytes: Buffer.byteLength(context, "utf8"),
        };
    }
}

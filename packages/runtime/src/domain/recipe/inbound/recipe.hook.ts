import type {
    BuildRecipeContextUsecase,
    RecipeContext,
} from "~runtime/domain/recipe/application/build.recipe.context.usecase.js";
import type {RefreshRecipeCacheUsecase} from "~runtime/domain/recipe/application/refresh.recipe.cache.usecase.js";
import type {
    RecipeScanRequest,
    RequestRecipeScanUsecase,
} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";

/** 레시피 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface RecipeHook {
    readonly refreshCache: RefreshRecipeCacheUsecase;
    readonly buildContext: BuildRecipeContextUsecase;
    readonly requestScan: RequestRecipeScanUsecase;
}

export function onRecipeCacheRefresh(hook: RecipeHook): Promise<boolean> {
    return hook.refreshCache.execute();
}

export function onPromptRecipes(hook: RecipeHook, prompt: string, limit?: number): RecipeContext {
    return hook.buildContext.execute(prompt, limit);
}

export function onRecipeScanRequested(hook: RecipeHook, request: RecipeScanRequest): Promise<boolean> {
    return hook.requestScan.execute(request);
}

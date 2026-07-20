import type {BuildRecipeMenuUsecase} from "~runtime/domain/recipe/application/build.recipe.menu.usecase.js";
import type {GetRecipeUsecase} from "~runtime/domain/recipe/application/get.recipe.usecase.js";
import type {RefreshRecipeCacheUsecase} from "~runtime/domain/recipe/application/refresh.recipe.cache.usecase.js";
import type {
    RecipeScanRequest,
    RequestRecipeScanUsecase,
} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";
import type {ReportRecipeOutcomeUsecase} from "~runtime/domain/recipe/application/report.recipe.outcome.usecase.js";
import type {RecipeOutcomeReportInput} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";

/** 레시피 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface RecipeHook {
    readonly refreshCache: RefreshRecipeCacheUsecase;
    readonly buildMenu: BuildRecipeMenuUsecase;
    readonly getRecipe: GetRecipeUsecase;
    readonly requestScan: RequestRecipeScanUsecase;
    readonly reportOutcome: ReportRecipeOutcomeUsecase;
}

export function onRecipeCacheRefresh(hook: RecipeHook): Promise<boolean> {
    return hook.refreshCache.execute();
}

export function onRecipeMenu(hook: RecipeHook): string {
    return hook.buildMenu.execute();
}

export function onGetRecipe(hook: RecipeHook, recipeId: string): string | null {
    return hook.getRecipe.execute(recipeId);
}

export function onRecipeScanRequested(hook: RecipeHook, request: RecipeScanRequest): Promise<boolean> {
    return hook.requestScan.execute(request);
}

export function onRecipeOutcomeReported(hook: RecipeHook, input: RecipeOutcomeReportInput): Promise<boolean> {
    return hook.reportOutcome.execute(input);
}

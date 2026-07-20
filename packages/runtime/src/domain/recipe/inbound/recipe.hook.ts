import type {GetRecipeUsecase} from "~runtime/domain/recipe/application/get.recipe.usecase.js";
import type {
    RecipeScanRequest,
    RequestRecipeScanUsecase,
} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";
import type {ReportRecipeOutcomeUsecase} from "~runtime/domain/recipe/application/report.recipe.outcome.usecase.js";
import type {SearchRecipesInput, SearchRecipesUsecase} from "~runtime/domain/recipe/application/search.recipes.usecase.js";
import type {RecipeOutcomeReportInput} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";
import type {RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";

/** 레시피 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface RecipeHook {
    readonly getRecipe: GetRecipeUsecase;
    readonly requestScan: RequestRecipeScanUsecase;
    readonly reportOutcome: ReportRecipeOutcomeUsecase;
    readonly searchRecipes: SearchRecipesUsecase;
}

export function onGetRecipe(hook: RecipeHook, recipeId: string): Promise<string | null> {
    return hook.getRecipe.execute(recipeId);
}

export function onRecipeSearchRequested(
    hook: RecipeHook,
    input: SearchRecipesInput,
): Promise<readonly RecipeSearchResultItem[]> {
    return hook.searchRecipes.execute(input);
}

export function onRecipeScanRequested(hook: RecipeHook, request: RecipeScanRequest): Promise<boolean> {
    return hook.requestScan.execute(request);
}

export function onRecipeOutcomeReported(hook: RecipeHook, input: RecipeOutcomeReportInput): Promise<boolean> {
    return hook.reportOutcome.execute(input);
}

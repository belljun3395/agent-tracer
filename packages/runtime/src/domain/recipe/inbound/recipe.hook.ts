import type {ClearRecipeMarkUsecase} from "~runtime/domain/recipe/application/clear.recipe.mark.usecase.js";
import type {GetRecipeUsecase} from "~runtime/domain/recipe/application/get.recipe.usecase.js";
import type {MarkRecipeOpenedUsecase} from "~runtime/domain/recipe/application/mark.recipe.opened.usecase.js";
import type {ReadPendingRecipeMarkUsecase} from "~runtime/domain/recipe/application/read.pending.recipe.mark.usecase.js";
import type {
    RecipeScanRequest,
    RequestRecipeScanUsecase,
} from "~runtime/domain/recipe/application/request.recipe.scan.usecase.js";
import type {ReportRecipeOutcomeUsecase} from "~runtime/domain/recipe/application/report.recipe.outcome.usecase.js";
import type {SearchRecipesInput, SearchRecipesUsecase} from "~runtime/domain/recipe/application/search.recipes.usecase.js";
import type {RecipePendingMark} from "~runtime/domain/recipe/model/recipe.pending.mark.model.js";
import type {RecipeOutcomeReportInput, RecipeOutcomeReportResult} from "~runtime/domain/recipe/port/recipe.outcome.report.port.js";
import type {RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";
import type {Fetched} from "~runtime/support/fetched.js";

/** 레시피 도메인이 어댑터에 제공하는 진입점 묶음이다. */
export interface RecipeHook {
    readonly getRecipe: GetRecipeUsecase;
    readonly requestScan: RequestRecipeScanUsecase;
    readonly reportOutcome: ReportRecipeOutcomeUsecase;
    readonly searchRecipes: SearchRecipesUsecase;
}

/** get_recipe·report_recipe_outcome이 남기고 지우고, UserPromptSubmit이 읽는 미보고 마크 진입점이다. */
export interface RecipeOutcomeMarkHook {
    readonly markOpened: MarkRecipeOpenedUsecase;
    readonly clearMark: ClearRecipeMarkUsecase;
    readonly readPendingMark: ReadPendingRecipeMarkUsecase;
}

export function onGetRecipe(hook: RecipeHook, recipeId: string): Promise<Fetched<string>> {
    return hook.getRecipe.execute(recipeId);
}

export function onRecipeSearchRequested(
    hook: RecipeHook,
    input: SearchRecipesInput,
): Promise<Fetched<readonly RecipeSearchResultItem[]>> {
    return hook.searchRecipes.execute(input);
}

export function onRecipeScanRequested(hook: RecipeHook, request: RecipeScanRequest): Promise<boolean> {
    return hook.requestScan.execute(request);
}

export function onRecipeOutcomeReported(
    hook: RecipeHook,
    input: RecipeOutcomeReportInput,
): Promise<RecipeOutcomeReportResult> {
    return hook.reportOutcome.execute(input);
}

export function onRecipeOpened(hook: RecipeOutcomeMarkHook, taskId: string, recipeId: string): void {
    hook.markOpened.execute(taskId, recipeId);
}

export function onRecipeMarkCleared(hook: RecipeOutcomeMarkHook, taskId: string, recipeId: string): void {
    hook.clearMark.execute(taskId, recipeId);
}

export function onPendingRecipeMarkRequested(hook: RecipeOutcomeMarkHook, taskId: string): RecipePendingMark | undefined {
    return hook.readPendingMark.execute(taskId);
}

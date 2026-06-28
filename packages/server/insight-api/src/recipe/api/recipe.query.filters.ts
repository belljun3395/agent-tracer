import { BadRequestException } from "@nestjs/common";
import { RECIPE_STATUSES } from "../domain/recipe.entity.js";
import type { RecipeCandidateStatusFilter } from "../application/dto/recipe.usecase.dto.js";
import type { ListRecipesUseCaseIn } from "../application/dto/list.recipes.usecase.dto.js";

type RecipeStatusFilter = NonNullable<ListRecipesUseCaseIn["status"]>;

export const RECIPE_CANDIDATE_STATUS_FILTERS = ["pending", "all"] as const satisfies readonly RecipeCandidateStatusFilter[];
export const RECIPE_STATUS_FILTERS = [...RECIPE_STATUSES, "all"] as const satisfies readonly RecipeStatusFilter[];

const RECIPE_CANDIDATE_STATUS_FILTER_SET: ReadonlySet<string> = new Set(RECIPE_CANDIDATE_STATUS_FILTERS);
const RECIPE_STATUS_FILTER_SET: ReadonlySet<string> = new Set(RECIPE_STATUS_FILTERS);

export function parseRecipeCandidateStatusFilter(raw: string | undefined): RecipeCandidateStatusFilter {
    const value = raw ?? "pending";
    if (isRecipeCandidateStatusFilter(value)) return value;
    throw new BadRequestException(`status must be one of: ${RECIPE_CANDIDATE_STATUS_FILTERS.join(", ")}`);
}

export function parseRecipeStatusFilter(raw: string | undefined): RecipeStatusFilter {
    const value = raw ?? "active";
    if (isRecipeStatusFilter(value)) return value;
    throw new BadRequestException(`status must be one of: ${RECIPE_STATUS_FILTERS.join(", ")}`);
}

function isRecipeCandidateStatusFilter(value: string): value is RecipeCandidateStatusFilter {
    return RECIPE_CANDIDATE_STATUS_FILTER_SET.has(value);
}

function isRecipeStatusFilter(value: string): value is RecipeStatusFilter {
    return RECIPE_STATUS_FILTER_SET.has(value);
}

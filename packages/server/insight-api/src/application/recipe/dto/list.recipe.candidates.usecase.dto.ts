import type {
    RecipeCandidateDto,
    RecipeCandidateStatusFilter,
} from "@monitor/insight-api/application/recipe/dto/recipe.usecase.dto.js";

export interface ListRecipeCandidatesUseCaseIn {
    readonly status?: RecipeCandidateStatusFilter;
}

export interface ListRecipeCandidatesUseCaseOut {
    readonly candidates: readonly RecipeCandidateDto[];
}

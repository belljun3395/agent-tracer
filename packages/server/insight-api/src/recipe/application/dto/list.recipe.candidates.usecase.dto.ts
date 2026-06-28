import type {
    RecipeCandidateDto,
    RecipeCandidateStatusFilter,
} from "./recipe.usecase.dto.js";

export interface ListRecipeCandidatesUseCaseIn {
    readonly status?: RecipeCandidateStatusFilter;
}

export interface ListRecipeCandidatesUseCaseOut {
    readonly candidates: readonly RecipeCandidateDto[];
}

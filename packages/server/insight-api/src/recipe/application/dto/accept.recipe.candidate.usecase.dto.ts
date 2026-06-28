export interface AcceptRecipeCandidateUseCaseIn {
    readonly candidateId: string;
}

export interface AcceptRecipeCandidateUseCaseOut {
    readonly status: "accepted" | "not_found" | "not_pending";
    readonly recipeId?: string;
}

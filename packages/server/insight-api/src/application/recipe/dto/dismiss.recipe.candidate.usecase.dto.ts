export interface DismissRecipeCandidateUseCaseIn {
    readonly candidateId: string;
}

export interface DismissRecipeCandidateUseCaseOut {
    readonly status: "dismissed" | "not_found" | "not_pending";
}

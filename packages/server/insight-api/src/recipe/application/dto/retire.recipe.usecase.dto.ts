export interface RetireRecipeUseCaseIn {
    readonly recipeId: string;
}

export interface RetireRecipeUseCaseOut {
    readonly status: "retired" | "not_found" | "already_retired";
}

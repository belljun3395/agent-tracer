export type ListEvaluationsRatingUseCaseDto = "good" | "skip";
export interface ListEvaluationsUseCaseIn { readonly rating?: ListEvaluationsRatingUseCaseDto | undefined }
export type ListEvaluationsUseCaseOut = unknown;

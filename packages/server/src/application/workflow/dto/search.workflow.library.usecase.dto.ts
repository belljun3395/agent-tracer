export type SearchWorkflowLibraryRatingUseCaseDto = "good" | "skip";
export interface SearchWorkflowLibraryUseCaseIn { readonly query: string; readonly rating?: SearchWorkflowLibraryRatingUseCaseDto | undefined; readonly limit?: number | undefined }
export type SearchWorkflowLibraryUseCaseOut = unknown;

export type ListPlaybooksStatusUseCaseDto = "draft" | "active" | "archived";
export interface ListPlaybooksUseCaseIn { readonly query?: string | undefined; readonly status?: ListPlaybooksStatusUseCaseDto | undefined; readonly limit?: number | undefined }
export type ListPlaybooksUseCaseOut = unknown;

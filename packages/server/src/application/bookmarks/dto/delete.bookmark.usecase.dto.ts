export interface DeleteBookmarkUseCaseIn {
    readonly bookmarkId: string;
}

export interface DeleteBookmarkUseCaseOut {
    readonly status: "deleted" | "not_found";
}

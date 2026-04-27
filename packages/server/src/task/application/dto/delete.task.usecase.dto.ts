export interface DeleteTaskUseCaseIn {
    readonly taskId: string;
}

export interface DeleteTaskUseCaseOut {
    readonly status: "deleted" | "not_found";
}

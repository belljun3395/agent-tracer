export interface ReslugTaskUseCaseIn {
    readonly taskId: string;
    readonly slug: string;
}

export interface ReslugTaskUseCaseOut {
    readonly status: "reslugged" | "not_found";
}

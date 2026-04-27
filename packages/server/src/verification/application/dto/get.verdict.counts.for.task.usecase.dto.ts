export interface GetVerdictCountsForTaskUseCaseIn {
    readonly taskId: string;
}

export interface GetVerdictCountsForTaskUseCaseOut {
    readonly verified: number;
    readonly contradicted: number;
    readonly unverifiable: number;
}

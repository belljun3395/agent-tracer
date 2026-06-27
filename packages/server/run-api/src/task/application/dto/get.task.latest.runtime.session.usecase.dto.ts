export interface GetTaskLatestRuntimeSessionUseCaseIn {
    readonly taskId: string;
}

export interface GetTaskLatestRuntimeSessionUseCaseOut {
    readonly runtimeSession: {
        readonly runtimeSource: string;
        readonly runtimeSessionId: string;
    } | null;
}

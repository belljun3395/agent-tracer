export interface ResolveRuntimeBindingUseCaseIn {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
}

export interface ResolveRuntimeBindingUseCaseOut {
    readonly taskId: string;
    readonly sessionId: string;
}

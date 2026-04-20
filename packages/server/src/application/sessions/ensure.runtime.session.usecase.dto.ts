export interface EnsureRuntimeSessionUseCaseIn {
    readonly taskId?: string;
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly title: string;
    readonly workspacePath?: string;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly resume?: boolean;
}

export interface EnsureRuntimeSessionUseCaseOut {
    readonly taskId: string;
    readonly sessionId: string;
    readonly taskCreated: boolean;
    readonly sessionCreated: boolean;
}

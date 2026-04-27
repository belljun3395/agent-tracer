export interface RuntimeBindingSnapshot {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly taskId: string;
    readonly monitorSessionId: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface RuntimeBindingUpsertInput {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
    readonly taskId: string;
    readonly monitorSessionId: string;
}

export interface RuntimeBindingLatestForTask {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
}

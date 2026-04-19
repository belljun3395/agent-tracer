export interface RuntimeBinding {
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
export interface IRuntimeBindingRepository {
    upsert(input: RuntimeBindingUpsertInput): Promise<RuntimeBinding>;
    find(runtimeSource: string, runtimeSessionId: string): Promise<RuntimeBinding | null>;
    findTaskId(runtimeSource: string, runtimeSessionId: string): Promise<string | null>;
    findLatestByTaskId(taskId: string): Promise<{
        runtimeSource: string;
        runtimeSessionId: string;
    } | null>;
    clearSession(runtimeSource: string, runtimeSessionId: string): Promise<void>;
    delete(runtimeSource: string, runtimeSessionId: string): Promise<void>;
}

import type { RuntimeSessionId, RuntimeSource, SessionId, TaskId } from "@monitor/domain";
export interface RuntimeBinding {
    readonly runtimeSource: RuntimeSource;
    readonly runtimeSessionId: RuntimeSessionId;
    readonly taskId: TaskId;
    readonly monitorSessionId: SessionId;
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface RuntimeBindingUpsertInput {
    readonly runtimeSource: RuntimeSource;
    readonly runtimeSessionId: RuntimeSessionId;
    readonly taskId: TaskId;
    readonly monitorSessionId: SessionId;
}
export interface IRuntimeBindingRepository {
    upsert(input: RuntimeBindingUpsertInput): Promise<RuntimeBinding>;
    find(runtimeSource: RuntimeSource, runtimeSessionId: RuntimeSessionId): Promise<RuntimeBinding | null>;
    findTaskId(runtimeSource: RuntimeSource, runtimeSessionId: RuntimeSessionId): Promise<TaskId | null>;
    findLatestByTaskId(taskId: TaskId): Promise<{
        runtimeSource: RuntimeSource;
        runtimeSessionId: RuntimeSessionId;
    } | null>;
    clearSession(runtimeSource: RuntimeSource, runtimeSessionId: RuntimeSessionId): Promise<void>;
    delete(runtimeSource: RuntimeSource, runtimeSessionId: RuntimeSessionId): Promise<void>;
}

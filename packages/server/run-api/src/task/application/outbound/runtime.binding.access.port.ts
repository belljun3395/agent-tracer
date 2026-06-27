

export interface RuntimeBindingAccessRecord {
    readonly runtimeSource: string;
    readonly runtimeSessionId: string;
}

export interface IRuntimeBindingAccess {
    findLatestByTaskId(taskId: string): Promise<RuntimeBindingAccessRecord | null>;
}

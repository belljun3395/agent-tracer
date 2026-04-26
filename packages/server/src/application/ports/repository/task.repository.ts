import type { MonitoringTask, TaskStatus } from "~domain/monitoring/index.js";
export interface TaskUpsertInput {
    readonly id: string;
    readonly title: string;
    readonly slug: string;
    readonly status: MonitoringTask["status"];
    readonly taskKind: NonNullable<MonitoringTask["taskKind"]>;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: MonitoringTask["workspacePath"];
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
    readonly runtimeSource?: MonitoringTask["runtimeSource"];
}
export interface ITaskRepository {
    upsert(input: TaskUpsertInput): Promise<MonitoringTask>;
    findById(id: string): Promise<MonitoringTask | null>;
    findAll(): Promise<readonly MonitoringTask[]>;
    findChildren(parentId: string): Promise<readonly MonitoringTask[]>;
    updateStatus(id: string, status: MonitoringTask["status"], updatedAt: string): Promise<void>;
    updateTitle(id: string, title: string, slug: MonitoringTask["slug"], updatedAt: string): Promise<void>;
    delete(id: string): Promise<{
        deletedIds: readonly string[];
    }>;
    deleteFinished(): Promise<number>;
    listTaskStatuses(): Promise<readonly TaskStatus[]>;
    countTimelineEvents(): Promise<number>;
}

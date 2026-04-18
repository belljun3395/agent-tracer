import type { MonitoringTask, SessionId, TaskId } from "@monitor/domain";
export interface TaskUpsertInput {
    readonly id: TaskId;
    readonly title: string;
    readonly slug: string;
    readonly status: MonitoringTask["status"];
    readonly taskKind: NonNullable<MonitoringTask["taskKind"]>;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly workspacePath?: MonitoringTask["workspacePath"];
    readonly parentTaskId?: TaskId;
    readonly parentSessionId?: SessionId;
    readonly backgroundTaskId?: TaskId;
    readonly runtimeSource?: MonitoringTask["runtimeSource"];
}
export interface ITaskRepository {
    upsert(input: TaskUpsertInput): Promise<MonitoringTask>;
    findById(id: TaskId): Promise<MonitoringTask | null>;
    findAll(): Promise<readonly MonitoringTask[]>;
    findChildren(parentId: TaskId): Promise<readonly MonitoringTask[]>;
    updateStatus(id: TaskId, status: MonitoringTask["status"], updatedAt: string): Promise<void>;
    updateTitle(id: TaskId, title: string, slug: MonitoringTask["slug"], updatedAt: string): Promise<void>;
    delete(id: TaskId): Promise<{
        deletedIds: readonly TaskId[];
    }>;
    deleteFinished(): Promise<number>;
    getOverviewStats(): Promise<OverviewStats>;
}
export interface OverviewStats {
    readonly totalTasks: number;
    readonly runningTasks: number;
    readonly waitingTasks: number;
    readonly completedTasks: number;
    readonly erroredTasks: number;
    readonly totalEvents: number;
}

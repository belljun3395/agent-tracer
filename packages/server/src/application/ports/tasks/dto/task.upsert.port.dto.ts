import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";

export interface TaskUpsertPortDto {
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

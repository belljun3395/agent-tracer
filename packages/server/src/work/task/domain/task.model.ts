import type { MonitoringTaskKind, TaskStatus } from "~work/task/common/task.status.type.js";

export interface MonitoringTaskInput {
    readonly title: string;
    readonly workspacePath?: string;
    readonly taskKind?: MonitoringTaskKind;
    readonly parentTaskId?: string;
    readonly parentSessionId?: string;
    readonly backgroundTaskId?: string;
}

export interface MonitoringTask extends MonitoringTaskInput {
    readonly id: string;
    readonly slug: string;
    readonly displayTitle?: string;
    readonly status: TaskStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly lastSessionStartedAt?: string;
    readonly runtimeSource?: string;
    readonly taskKind?: MonitoringTaskKind;
}

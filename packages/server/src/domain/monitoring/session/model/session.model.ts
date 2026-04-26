import type { TaskStatus } from "~domain/monitoring/common/type/task.status.type.js";

export interface MonitoringSession {
    readonly id: string;
    readonly taskId: string;
    readonly status: Extract<TaskStatus, "running" | "completed" | "errored">;
    readonly summary?: string;
    readonly startedAt: string;
    readonly endedAt?: string;
}

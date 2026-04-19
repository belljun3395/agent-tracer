import type { TaskStatus } from "./task.status.js";

export interface MonitoringSession {
    readonly id: string;
    readonly taskId: string;
    readonly status: Extract<TaskStatus, "running" | "completed" | "errored">;
    readonly summary?: string;
    readonly startedAt: string;
    readonly endedAt?: string;
}

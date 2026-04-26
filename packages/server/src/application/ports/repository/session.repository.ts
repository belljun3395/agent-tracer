import type { MonitoringSession } from "~domain/monitoring/index.js";
export interface SessionCreateInput {
    readonly id: string;
    readonly taskId: string;
    readonly status: MonitoringSession["status"];
    readonly startedAt: string;
    readonly summary?: string;
}
export interface ISessionRepository {
    create(input: SessionCreateInput): Promise<MonitoringSession>;
    findById(id: string): Promise<MonitoringSession | null>;
    findByTaskId(taskId: string): Promise<readonly MonitoringSession[]>;
    findActiveByTaskId(taskId: string): Promise<MonitoringSession | null>;
    updateStatus(id: string, status: MonitoringSession["status"], endedAt: string, summary?: string): Promise<void>;
    countRunningByTaskId(taskId: string): Promise<number>;
}

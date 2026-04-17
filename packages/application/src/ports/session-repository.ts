import type { MonitoringSession, SessionId, TaskId } from "@monitor/domain";
export interface SessionCreateInput {
    readonly id: SessionId;
    readonly taskId: TaskId;
    readonly status: MonitoringSession["status"];
    readonly startedAt: string;
    readonly summary?: string;
}
export interface ISessionRepository {
    create(input: SessionCreateInput): Promise<MonitoringSession>;
    findById(id: SessionId): Promise<MonitoringSession | null>;
    findByTaskId(taskId: TaskId): Promise<readonly MonitoringSession[]>;
    findActiveByTaskId(taskId: TaskId): Promise<MonitoringSession | null>;
    updateStatus(id: SessionId, status: MonitoringSession["status"], endedAt: string, summary?: string): Promise<void>;
    countRunningByTaskId(taskId: TaskId): Promise<number>;
}

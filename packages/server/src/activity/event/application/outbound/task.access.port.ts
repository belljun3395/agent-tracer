/**
 * Outbound port — event module needs to read+update task status when an
 * event has a task-status side effect (e.g. user.message moves task to running).
 */

export type EventTaskStatus = "running" | "waiting" | "completed" | "errored";

export interface EventTaskRecord {
    readonly id: string;
    readonly status: EventTaskStatus;
    readonly title: string;
    readonly slug: string;
    readonly createdAt: string;
    readonly updatedAt: string;
}

export interface IEventTaskAccess {
    findById(id: string): Promise<EventTaskRecord | null>;
    updateStatus(id: string, status: EventTaskStatus, updatedAt: string): Promise<void>;
}

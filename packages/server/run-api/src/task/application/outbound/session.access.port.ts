

export type SessionAccessStatus = "running" | "completed" | "errored";

export interface SessionAccessRecord {
    readonly id: string;
    readonly taskId: string;
    readonly status: SessionAccessStatus;
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly summary?: string;
}

export interface SessionCreateRequest {
    readonly id: string;
    readonly taskId: string;
    readonly status: SessionAccessStatus;
    readonly startedAt: string;
    readonly summary?: string;
}

export interface ISessionAccess {
    create(input: SessionCreateRequest): Promise<SessionAccessRecord>;
    findById(id: string): Promise<SessionAccessRecord | null>;
    findActiveByTaskId(taskId: string): Promise<SessionAccessRecord | null>;
    countRunningByTaskId(taskId: string): Promise<number>;
    updateStatus(
        id: string,
        status: SessionAccessStatus,
        endedAt: string,
        summary?: string,
    ): Promise<void>;
}

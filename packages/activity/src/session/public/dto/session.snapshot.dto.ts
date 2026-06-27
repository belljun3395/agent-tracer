export type SessionStatus = "running" | "completed" | "errored";

export interface SessionSnapshot {
    readonly id: string;
    readonly taskId: string;
    readonly status: SessionStatus;
    readonly startedAt: string;
    readonly endedAt?: string;
    readonly summary?: string;
}

export interface SessionCreateInput {
    readonly id: string;
    readonly taskId: string;
    readonly status: SessionStatus;
    readonly startedAt: string;
    readonly summary?: string;
}

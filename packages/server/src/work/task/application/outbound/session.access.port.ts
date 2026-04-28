/**
 * Outbound port. Self-contained.
 *
 * What task module needs from session module:
 *   - create a runtime session for a new task
 *   - find / update session status when finalizing a task
 */

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
    updateStatus(
        id: string,
        status: SessionAccessStatus,
        endedAt: string,
        summary?: string,
    ): Promise<void>;
}

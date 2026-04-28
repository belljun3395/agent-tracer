import type {
    SessionCreateInput,
    SessionSnapshot,
    SessionStatus,
} from "../dto/session.snapshot.dto.js";

/**
 * Public iservice exposing session lifecycle operations to other modules.
 */
export interface ISessionLifecycle {
    create(input: SessionCreateInput): Promise<SessionSnapshot>;
    findById(id: string): Promise<SessionSnapshot | null>;
    findByTaskId(taskId: string): Promise<readonly SessionSnapshot[]>;
    findActiveByTaskId(taskId: string): Promise<SessionSnapshot | null>;
    countRunningByTaskId(taskId: string): Promise<number>;
    updateStatus(
        id: string,
        status: SessionStatus,
        endedAt: string,
        summary?: string,
    ): Promise<void>;
}

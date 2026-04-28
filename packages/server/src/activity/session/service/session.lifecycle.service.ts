import { Injectable } from "@nestjs/common";
import { SessionEntity } from "../domain/session.entity.js";
import type {
    SessionCreateInput,
    SessionSnapshot,
    SessionStatus,
} from "../public/dto/session.snapshot.dto.js";
import { SessionRepository } from "../repository/session.repository.js";

/**
 * Service for session lifecycle operations.
 *
 * Used internally by session usecases AND directly bound to the public
 * SESSION_LIFECYCLE token (it satisfies ISessionLifecycle structurally).
 * Returns SessionSnapshot DTOs so callers don't depend on the TypeORM entity.
 */
@Injectable()
export class SessionLifecycleService {
    constructor(private readonly repo: SessionRepository) {}

    async create(input: SessionCreateInput): Promise<SessionSnapshot> {
        const entity = new SessionEntity();
        entity.id = input.id;
        entity.taskId = input.taskId;
        entity.status = input.status;
        entity.startedAt = input.startedAt;
        entity.summary = input.summary ?? null;
        entity.endedAt = null;
        const saved = await this.repo.save(entity);
        return saved.toSnapshot();
    }

    async findById(id: string): Promise<SessionSnapshot | null> {
        const entity = await this.repo.findById(id);
        return entity ? entity.toSnapshot() : null;
    }

    async findByTaskId(taskId: string): Promise<readonly SessionSnapshot[]> {
        const entities = await this.repo.findByTaskId(taskId);
        return entities.map((entity) => entity.toSnapshot());
    }

    async findActiveByTaskId(taskId: string): Promise<SessionSnapshot | null> {
        const entity = await this.repo.findActiveByTaskId(taskId);
        return entity ? entity.toSnapshot() : null;
    }

    async countRunningByTaskId(taskId: string): Promise<number> {
        return this.repo.countRunningByTaskId(taskId);
    }

    async updateStatus(
        id: string,
        status: SessionStatus,
        endedAt: string,
        summary?: string,
    ): Promise<void> {
        const entity = await this.repo.findById(id);
        if (!entity) return;
        if (status === "running") {
            entity.status = status;
            entity.endedAt = null;
            if (summary !== undefined) entity.summary = summary;
        } else {
            entity.end(endedAt, status, summary);
        }
        await this.repo.save(entity);
    }
}

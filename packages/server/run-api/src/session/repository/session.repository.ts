import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SessionEntity } from "../domain/session.entity.js";
import { RUNNING_SESSION_STATUS } from "../domain/session.predicates.policy.js";
import type {
    SessionCreateInput,
    SessionSnapshot,
    SessionStatus,
} from "../public/dto/session.snapshot.dto.js";
import type { ISessionLifecycle } from "../public/iservice/session.lifecycle.iservice.js";

@Injectable()
export class SessionRepository implements ISessionLifecycle {
    constructor(
        @InjectRepository(SessionEntity)
        private readonly repo: Repository<SessionEntity>,
    ) {}

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
        const entity = await this.repo.findOne({ where: { id } });
        return entity ? entity.toSnapshot() : null;
    }

    async findByTaskId(taskId: string): Promise<readonly SessionSnapshot[]> {
        const entities = await this.repo.find({
            where: { taskId },
            order: { startedAt: "ASC" },
        });
        return entities.map((e) => e.toSnapshot());
    }

    async findActiveByTaskId(taskId: string): Promise<SessionSnapshot | null> {
        const entity = await this.repo.findOne({
            where: { taskId, status: RUNNING_SESSION_STATUS },
            order: { startedAt: "DESC" },
        });
        return entity ? entity.toSnapshot() : null;
    }

    async countRunningByTaskId(taskId: string): Promise<number> {
        return this.repo.count({ where: { taskId, status: RUNNING_SESSION_STATUS } });
    }

    async updateStatus(
        id: string,
        status: SessionStatus,
        endedAt: string,
        summary?: string,
    ): Promise<void> {
        const entity = await this.repo.findOne({ where: { id } });
        if (!entity) return;
        if (status === RUNNING_SESSION_STATUS) {
            entity.status = status;
            entity.endedAt = null;
            if (summary !== undefined) entity.summary = summary;
        } else {
            entity.end(endedAt, status, summary);
        }
        await this.repo.save(entity);
    }
}

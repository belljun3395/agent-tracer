import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type { SessionStatus } from "../public/dto/session.snapshot.dto.js";
import { SessionEntity } from "../domain/session.entity.js";

@Injectable()
export class SessionRepository {
    constructor(
        @InjectRepository(SessionEntity)
        private readonly repo: Repository<SessionEntity>,
    ) {}

    async findById(id: string): Promise<SessionEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByTaskId(taskId: string): Promise<SessionEntity[]> {
        return this.repo.find({
            where: { taskId },
            order: { startedAt: "ASC" },
        });
    }

    // Generic — caller supplies the status. Repository doesn't decide which
    // status counts as "active" / "running"; the service owns that.
    async findLatestByTaskIdAndStatus(taskId: string, status: SessionStatus): Promise<SessionEntity | null> {
        return this.repo.findOne({
            where: { taskId, status },
            order: { startedAt: "DESC" },
        });
    }

    async countByTaskIdAndStatus(taskId: string, status: SessionStatus): Promise<number> {
        return this.repo.count({ where: { taskId, status } });
    }

    async save(entity: SessionEntity): Promise<SessionEntity> {
        return this.repo.save(entity);
    }
}

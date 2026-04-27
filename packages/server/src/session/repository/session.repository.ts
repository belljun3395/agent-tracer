import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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

    async findActiveByTaskId(taskId: string): Promise<SessionEntity | null> {
        return this.repo.findOne({
            where: { taskId, status: "running" },
            order: { startedAt: "DESC" },
        });
    }

    async countRunningByTaskId(taskId: string): Promise<number> {
        return this.repo.count({ where: { taskId, status: "running" } });
    }

    async save(entity: SessionEntity): Promise<SessionEntity> {
        return this.repo.save(entity);
    }
}

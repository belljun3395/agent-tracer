import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository, type QueryDeepPartialEntity } from "typeorm";
import { TimelineEventEntity } from "../domain/timeline.event.entity.js";

@Injectable()
export class TimelineEventRepository {
    constructor(
        @InjectRepository(TimelineEventEntity)
        private readonly repo: Repository<TimelineEventEntity>,
    ) {}

    findOwned(id: string, userId: string): Promise<TimelineEventEntity | null> {
        return this.repo.findOne({ where: { id, userId } });
    }

    findByIds(ids: readonly string[]): Promise<TimelineEventEntity[]> {
        if (ids.length === 0) return Promise.resolve([]);
        return this.repo.find({ where: { id: In([...ids]) } });
    }

    findByTaskIdOrdered(taskId: string, userId: string): Promise<TimelineEventEntity[]> {
        return this.repo.find({ where: { taskId, userId }, order: { seq: "ASC" } });
    }

    countByUser(userId: string): Promise<number> {
        return this.repo.count({ where: { userId } });
    }

    save(entity: TimelineEventEntity): Promise<TimelineEventEntity> {
        return this.repo.save(entity);
    }

    // 멱등 ingest: 같은 id가 이미 있으면 조용히 무시(ON CONFLICT DO NOTHING).
    async insertIgnoreConflict(entity: TimelineEventEntity): Promise<void> {
        await this.repo
            .createQueryBuilder()
            .insert()
            .values(entity as QueryDeepPartialEntity<TimelineEventEntity>)
            .orIgnore()
            .execute();
    }
}

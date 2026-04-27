import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { TimelineEventEntity } from "../domain/timeline.event.entity.js";

@Injectable()
export class TimelineEventRepository {
    constructor(
        @InjectRepository(TimelineEventEntity)
        private readonly repo: Repository<TimelineEventEntity>,
    ) {}

    findById(id: string): Promise<TimelineEventEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    findByIds(ids: readonly string[]): Promise<TimelineEventEntity[]> {
        if (ids.length === 0) return Promise.resolve([]);
        return this.repo.find({ where: { id: In([...ids]) } });
    }

    findByTaskIdOrdered(taskId: string): Promise<TimelineEventEntity[]> {
        return this.repo.find({ where: { taskId }, order: { createdAt: "ASC" } });
    }

    save(entity: TimelineEventEntity): Promise<TimelineEventEntity> {
        return this.repo.save(entity);
    }

    async updateExtras(id: string, fields: Partial<TimelineEventEntity>): Promise<void> {
        await this.repo.update({ id }, fields);
    }
}

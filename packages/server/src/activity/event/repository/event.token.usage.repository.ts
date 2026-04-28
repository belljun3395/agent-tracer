import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { EventTokenUsageEntity } from "../domain/event.token.usage.entity.js";

@Injectable()
export class EventTokenUsageRepository {
    constructor(
        @InjectRepository(EventTokenUsageEntity)
        private readonly repo: Repository<EventTokenUsageEntity>,
    ) {}

    findByEventIds(eventIds: readonly string[]): Promise<EventTokenUsageEntity[]> {
        if (eventIds.length === 0) return Promise.resolve([]);
        return this.repo.find({ where: { eventId: In([...eventIds]) } });
    }

    async deleteByEventId(eventId: string): Promise<void> {
        await this.repo.delete({ eventId });
    }

    insert(row: EventTokenUsageEntity): Promise<EventTokenUsageEntity> {
        return this.repo.save(row);
    }
}

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { EventAsyncRefEntity } from "../domain/event.async.ref.entity.js";

@Injectable()
export class EventAsyncRefRepository {
    constructor(
        @InjectRepository(EventAsyncRefEntity)
        private readonly repo: Repository<EventAsyncRefEntity>,
    ) {}

    findByEventIds(eventIds: readonly string[]): Promise<EventAsyncRefEntity[]> {
        if (eventIds.length === 0) return Promise.resolve([]);
        return this.repo.find({ where: { eventId: In([...eventIds]) } });
    }

    async deleteByEventId(eventId: string): Promise<void> {
        await this.repo.delete({ eventId });
    }

    insert(row: EventAsyncRefEntity): Promise<EventAsyncRefEntity> {
        return this.repo.save(row);
    }
}

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { EventTagEntity } from "../domain/event.tag.entity.js";

@Injectable()
export class EventTagRepository {
    constructor(
        @InjectRepository(EventTagEntity)
        private readonly repo: Repository<EventTagEntity>,
    ) {}

    findByEventIds(eventIds: readonly string[]): Promise<EventTagEntity[]> {
        if (eventIds.length === 0) return Promise.resolve([]);
        return this.repo.find({
            where: { eventId: In([...eventIds]) },
            order: { eventId: "ASC", tag: "ASC" },
        });
    }

    async deleteByEventId(eventId: string): Promise<void> {
        await this.repo.delete({ eventId });
    }

    insertMany(rows: readonly EventTagEntity[]): Promise<EventTagEntity[]> {
        if (rows.length === 0) return Promise.resolve([]);
        return this.repo.save([...rows]);
    }
}

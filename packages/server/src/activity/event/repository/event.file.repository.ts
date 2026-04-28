import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { EventFileEntity } from "../domain/event.file.entity.js";

@Injectable()
export class EventFileRepository {
    constructor(
        @InjectRepository(EventFileEntity)
        private readonly repo: Repository<EventFileEntity>,
    ) {}

    findByEventIds(eventIds: readonly string[]): Promise<EventFileEntity[]> {
        if (eventIds.length === 0) return Promise.resolve([]);
        return this.repo.find({
            where: { eventId: In([...eventIds]) },
            order: { eventId: "ASC", filePath: "ASC" },
        });
    }

    async deleteByEventId(eventId: string): Promise<void> {
        await this.repo.delete({ eventId });
    }

    insertMany(rows: readonly EventFileEntity[]): Promise<EventFileEntity[]> {
        if (rows.length === 0) return Promise.resolve([]);
        return this.repo.save([...rows]);
    }
}

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { EventRelationEntity } from "../domain/event.relation.entity.js";

@Injectable()
export class EventRelationRepository {
    constructor(
        @InjectRepository(EventRelationEntity)
        private readonly repo: Repository<EventRelationEntity>,
    ) {}

    findByEventIds(eventIds: readonly string[]): Promise<EventRelationEntity[]> {
        if (eventIds.length === 0) return Promise.resolve([]);
        return this.repo.find({
            where: { eventId: In([...eventIds]) },
            order: { eventId: "ASC", edgeKind: "ASC", targetEventId: "ASC" },
        });
    }

    async deleteByEventId(eventId: string): Promise<void> {
        await this.repo.delete({ eventId });
    }

    async insertManyIgnoreDuplicates(rows: readonly EventRelationEntity[]): Promise<void> {
        if (rows.length === 0) return;
        await this.repo
            .createQueryBuilder()
            .insert()
            .into(EventRelationEntity)
            .values([...rows])
            .orIgnore()
            .execute();
    }
}

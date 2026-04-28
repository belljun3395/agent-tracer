import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { QuestionCurrentEntity } from "../domain/question.current.entity.js";

@Injectable()
export class QuestionCurrentRepository {
    constructor(
        @InjectRepository(QuestionCurrentEntity)
        private readonly repo: Repository<QuestionCurrentEntity>,
    ) {}

    findByLastEventIds(eventIds: readonly string[]): Promise<QuestionCurrentEntity[]> {
        if (eventIds.length === 0) return Promise.resolve([]);
        return this.repo.find({ where: { lastEventId: In([...eventIds]) } });
    }

    upsert(row: QuestionCurrentEntity): Promise<QuestionCurrentEntity> {
        return this.repo.save(row);
    }
}

import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { TodoCurrentEntity } from "../domain/todo.current.entity.js";

@Injectable()
export class TodoCurrentRepository {
    constructor(
        @InjectRepository(TodoCurrentEntity)
        private readonly repo: Repository<TodoCurrentEntity>,
    ) {}

    findByLastEventIds(eventIds: readonly string[]): Promise<TodoCurrentEntity[]> {
        if (eventIds.length === 0) return Promise.resolve([]);
        return this.repo.find({ where: { lastEventId: In([...eventIds]) } });
    }

    upsert(row: TodoCurrentEntity): Promise<TodoCurrentEntity> {
        return this.repo.save(row);
    }
}

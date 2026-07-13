import type { Repository } from "typeorm";
import type { TurnEntity } from "./turn.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";
import { TURN_STATUS } from "./turn.const.js";

export class TurnRepository {
    constructor(private readonly repo: Repository<TurnEntity>) {}

    async findOpenBySession(sessionId: string): Promise<TurnEntity | null> {
        return this.repo.findOne({ where: { sessionId, status: TURN_STATUS.open } });
    }

    async findLastIndex(sessionId: string): Promise<number> {
        const [last] = await this.repo.find({
            where: { sessionId },
            order: { turnIndex: "DESC" },
            take: 1,
        });
        return last?.turnIndex ?? 0;
    }

    async findById(id: string): Promise<TurnEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByTask(taskId: string): Promise<TurnEntity[]> {
        return this.repo.find({ where: { taskId }, order: { turnIndex: "ASC" } });
    }

    async upsert(turn: TurnEntity): Promise<void> {
        await upsertByKeys(this.repo, turn, ["id"]);
    }
}

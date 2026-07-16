import { IsNull, type Repository } from "typeorm";
import type { MemoEntity } from "./memo.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class MemoRepository {
    constructor(private readonly repo: Repository<MemoEntity>) {}

    async findById(id: string): Promise<MemoEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    // 태스크 메모(eventId 없음)와 이벤트 메모 전부가 포함된 쓰레드다.
    async findByTask(userId: string, taskId: string): Promise<MemoEntity[]> {
        return this.repo.find({
            where: { userId, taskId, deletedAt: IsNull() },
            order: { createdAt: "ASC" },
        });
    }

    async findByEvent(eventId: string): Promise<MemoEntity[]> {
        return this.repo.find({
            where: { eventId, deletedAt: IsNull() },
            order: { createdAt: "ASC" },
        });
    }

    async listAll(userId: string): Promise<MemoEntity[]> {
        return this.repo.find({ where: { userId, deletedAt: IsNull() } });
    }

    async upsert(memo: MemoEntity): Promise<void> {
        await upsertByKeys(this.repo, memo, ["id"]);
    }
}

import type { Repository } from "typeorm";
import type { ChatThreadEntity } from "./chat.thread.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class ChatThreadRepository {
    constructor(private readonly repo: Repository<ChatThreadEntity>) {}

    async create(thread: ChatThreadEntity): Promise<void> {
        await upsertByKeys(this.repo, thread, ["id"]);
    }

    async findById(id: string): Promise<ChatThreadEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    // 목록 화면은 최신 대화부터 보여준다.
    async listByUser(userId: string, limit?: number): Promise<ChatThreadEntity[]> {
        return this.repo.find({
            where: { userId },
            order: { updatedAt: "DESC" },
            ...(limit !== undefined ? { take: limit } : {}),
        });
    }

    async update(thread: ChatThreadEntity): Promise<void> {
        await upsertByKeys(this.repo, thread, ["id"]);
    }

    async deleteById(id: string): Promise<void> {
        await this.repo.delete({ id });
    }
}

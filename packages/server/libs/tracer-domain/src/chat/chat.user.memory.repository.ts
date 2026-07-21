import type { Repository } from "typeorm";
import type { ChatUserMemoryEntity } from "./chat.user.memory.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class ChatUserMemoryRepository {
    constructor(private readonly repo: Repository<ChatUserMemoryEntity>) {}

    async upsert(memory: ChatUserMemoryEntity): Promise<void> {
        await upsertByKeys(this.repo, memory, ["userId", "key"]);
    }

    async findByKey(userId: string, key: string): Promise<ChatUserMemoryEntity | null> {
        return this.repo.findOne({ where: { userId, key } });
    }

    async listByUser(userId: string): Promise<ChatUserMemoryEntity[]> {
        return this.repo.find({ where: { userId }, order: { updatedAt: "DESC" } });
    }
}

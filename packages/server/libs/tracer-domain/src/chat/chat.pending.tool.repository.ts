import type { Repository } from "typeorm";
import type { ChatPendingToolStatus } from "./chat.const.js";
import type { ChatPendingToolEntity } from "./chat.pending.tool.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class ChatPendingToolRepository {
    constructor(private readonly repo: Repository<ChatPendingToolEntity>) {}

    async create(pendingTool: ChatPendingToolEntity): Promise<void> {
        await upsertByKeys(this.repo, pendingTool, ["id"]);
    }

    async findById(id: string): Promise<ChatPendingToolEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async listByThread(threadId: string, status?: ChatPendingToolStatus): Promise<ChatPendingToolEntity[]> {
        return this.repo.find({
            where: { threadId, ...(status !== undefined ? { status } : {}) },
            order: { createdAt: "ASC" },
        });
    }

    // approve/reject로 전이된 엔티티를 그대로 반영하며, 판정 자체는 엔티티가 소유한다.
    async resolve(pendingTool: ChatPendingToolEntity): Promise<void> {
        await upsertByKeys(this.repo, pendingTool, ["id"]);
    }
}

import type { Repository } from "typeorm";
import type { ChatMessageEntity } from "./chat.message.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class ChatMessageRepository {
    constructor(private readonly repo: Repository<ChatMessageEntity>) {}

    async append(message: ChatMessageEntity): Promise<void> {
        await upsertByKeys(this.repo, message, ["id"]);
    }

    // 재생(replay)은 스레드 안에서 쌓인 순서 그대로다.
    async listByThread(threadId: string): Promise<ChatMessageEntity[]> {
        return this.repo.find({ where: { threadId }, order: { createdAt: "ASC" } });
    }

    // 스레드 삭제가 캐스케이드로 부르는 메서드다.
    async deleteByThread(threadId: string): Promise<void> {
        await this.repo.delete({ threadId });
    }
}

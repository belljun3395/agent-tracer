import { Inject, Injectable } from "@nestjs/common";
import {
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatUserMemoryRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapMemory, type ChatUserMemoryDto } from "~tracer-api/domain/chat/model/chat.model.js";

/** LangGraph 백엔드의 저장소가 사실을 되읽도록 이 사용자의 장기기억을 최신순으로 준다. */
@Injectable()
export class ListUserMemoriesUseCase {
    constructor(
        @Inject(CHAT_USER_MEMORY_REPOSITORY)
        private readonly memories: ChatUserMemoryRepositoryPort,
    ) {}

    async execute(userId: string): Promise<{ readonly items: readonly ChatUserMemoryDto[] }> {
        const rows = await this.memories.listByUser(userId);
        return { items: rows.map(mapMemory) };
    }
}

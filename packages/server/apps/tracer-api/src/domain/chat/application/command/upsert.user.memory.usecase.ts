import { Inject, Injectable } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { ChatUserMemoryEntity } from "@monitor/tracer-domain";
import {
    CHAT_USER_MEMORY_REPOSITORY,
    type ChatUserMemoryRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import { mapMemory, type ChatUserMemoryDto } from "~tracer-api/domain/chat/model/chat.model.js";

/** LangGraph 백엔드의 저장소가 장기기억을 정본에 써넣는 진입점이며, 같은 (userId,key)면 덮어쓴다. */
export interface UpsertUserMemoryInput {
    readonly userId: string;
    readonly key: string;
    readonly content: string;
}

/** remember_fact 핸들러와 같은 의미로 사용자 장기기억 한 줄을 정본에 즉시 upsert한다. */
@Injectable()
export class UpsertUserMemoryUseCase {
    constructor(
        @Inject(CHAT_USER_MEMORY_REPOSITORY)
        private readonly memories: ChatUserMemoryRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: UpsertUserMemoryInput): Promise<ChatUserMemoryDto> {
        const now = this.clock.now();
        const memory = ChatUserMemoryEntity.create({
            id: generateUlid(now.getTime()),
            userId: input.userId,
            key: input.key,
            content: input.content,
            now,
        });
        await this.memories.upsert(memory);
        return mapMemory(memory);
    }
}

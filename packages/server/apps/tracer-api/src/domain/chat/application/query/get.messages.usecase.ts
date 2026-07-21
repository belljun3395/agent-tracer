import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapMessage, type ChatMessageDto } from "~tracer-api/domain/chat/model/chat.model.js";

/** 스레드의 메시지를 쌓인 순서대로 소유자에게만 준다. */
@Injectable()
export class GetMessagesUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
    ) {}

    async execute(userId: string, threadId: string): Promise<{ readonly items: readonly ChatMessageDto[] }> {
        const thread = await this.threads.findById(threadId);
        if (thread === null || thread.userId !== userId) throw new NotFoundException("Thread not found");
        const rows = await this.messages.listByThread(threadId);
        return { items: rows.map(mapMessage) };
    }
}

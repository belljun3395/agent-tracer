import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { generateUlid } from "@monitor/platform";
import { CHAT_MESSAGE_ROLE, ChatMessageEntity } from "@monitor/tracer-domain";
import { CHAT_CLOCK, type ClockPort } from "~tracer-api/domain/chat/port/clock.port.js";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";
import { mapMessage, type ChatMessageDto } from "~tracer-api/domain/chat/model/chat.model.js";

export interface AppendUserMessageInput {
    readonly userId: string;
    readonly threadId: string;
    readonly content: string;
}

/** 사용자가 보낸 메시지를 스레드에 적재하며, 소유하지 않은 스레드면 거절한다. */
@Injectable()
export class AppendUserMessageUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_CLOCK)
        private readonly clock: ClockPort,
    ) {}

    async execute(input: AppendUserMessageInput): Promise<{ readonly message: ChatMessageDto }> {
        const thread = await this.threads.findById(input.threadId);
        if (thread === null || thread.userId !== input.userId) throw new NotFoundException("Thread not found");

        const now = this.clock.now();
        const message = ChatMessageEntity.create({
            id: generateUlid(now.getTime()),
            threadId: input.threadId,
            role: CHAT_MESSAGE_ROLE.user,
            content: input.content,
            now,
        });
        await this.messages.append(message);
        return { message: mapMessage(message) };
    }
}

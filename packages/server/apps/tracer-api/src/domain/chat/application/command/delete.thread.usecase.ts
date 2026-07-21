import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
    CHAT_MESSAGE_REPOSITORY,
    CHAT_PENDING_TOOL_REPOSITORY,
    CHAT_THREAD_REPOSITORY,
    type ChatMessageRepositoryPort,
    type ChatPendingToolRepositoryPort,
    type ChatThreadRepositoryPort,
} from "~tracer-api/domain/chat/port/chat.repository.port.js";

/** 소유한 대화 스레드를 그 메시지와 대기 도구까지 캐스케이드로 지운다. */
@Injectable()
export class DeleteThreadUseCase {
    constructor(
        @Inject(CHAT_THREAD_REPOSITORY)
        private readonly threads: ChatThreadRepositoryPort,
        @Inject(CHAT_MESSAGE_REPOSITORY)
        private readonly messages: ChatMessageRepositoryPort,
        @Inject(CHAT_PENDING_TOOL_REPOSITORY)
        private readonly pendingTools: ChatPendingToolRepositoryPort,
    ) {}

    async execute(userId: string, threadId: string): Promise<{ readonly deleted: true }> {
        const thread = await this.threads.findById(threadId);
        if (thread === null || thread.userId !== userId) throw new NotFoundException("Thread not found");

        // 사용자 장기기억은 스레드가 아니라 사용자에 매인 것이라 여기서 지우지 않는다.
        await Promise.all([this.messages.deleteByThread(threadId), this.pendingTools.deleteByThread(threadId)]);
        await this.threads.deleteById(threadId);

        return { deleted: true };
    }
}

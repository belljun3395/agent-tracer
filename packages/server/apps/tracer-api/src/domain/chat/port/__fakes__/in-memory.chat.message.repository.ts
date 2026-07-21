import type { ChatMessageEntity } from "@monitor/tracer-domain";
import type { ChatMessageRepositoryPort } from "~tracer-api/domain/chat/port/chat.repository.port.js";

/** 메시지 저장소 포트의 인메모리 대역이다. */
export class InMemoryChatMessageRepository implements ChatMessageRepositoryPort {
    private readonly rows: ChatMessageEntity[] = [];

    seed(...messages: readonly ChatMessageEntity[]): void {
        this.rows.push(...messages);
    }

    append(message: ChatMessageEntity): Promise<void> {
        this.rows.push(message);
        return Promise.resolve();
    }

    listByThread(threadId: string): Promise<ChatMessageEntity[]> {
        return Promise.resolve(
            this.rows
                .filter((message) => message.threadId === threadId)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
        );
    }

    deleteByThread(threadId: string): Promise<void> {
        const remaining = this.rows.filter((message) => message.threadId !== threadId);
        this.rows.length = 0;
        this.rows.push(...remaining);
        return Promise.resolve();
    }
}

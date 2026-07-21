import type { ChatThreadEntity } from "@monitor/tracer-domain";
import type { ChatThreadRepositoryPort } from "~tracer-api/domain/chat/port/chat.repository.port.js";

/** 스레드 저장소 포트의 인메모리 대역이다. */
export class InMemoryChatThreadRepository implements ChatThreadRepositoryPort {
    private readonly rows = new Map<string, ChatThreadEntity>();

    seed(...threads: readonly ChatThreadEntity[]): void {
        for (const thread of threads) this.rows.set(thread.id, thread);
    }

    create(thread: ChatThreadEntity): Promise<void> {
        this.rows.set(thread.id, thread);
        return Promise.resolve();
    }

    findById(id: string): Promise<ChatThreadEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    listByUser(userId: string, limit?: number): Promise<ChatThreadEntity[]> {
        const rows = [...this.rows.values()]
            .filter((thread) => thread.userId === userId)
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        return Promise.resolve(limit !== undefined ? rows.slice(0, limit) : rows);
    }

    update(thread: ChatThreadEntity): Promise<void> {
        this.rows.set(thread.id, thread);
        return Promise.resolve();
    }
}

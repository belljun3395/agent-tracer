import { CHAT_EXECUTION_STATUS, type ChatExecutionEntity } from "@monitor/tracer-domain";
import type { ChatExecutionRepositoryPort } from "../chat.repository.port.js";

export class InMemoryChatExecutionRepository implements ChatExecutionRepositoryPort {
    private readonly rows = new Map<string, ChatExecutionEntity>();

    seed(...executions: readonly ChatExecutionEntity[]): void {
        for (const execution of executions) this.rows.set(execution.id, execution);
    }

    findById(id: string): Promise<ChatExecutionEntity | null> {
        return Promise.resolve(this.rows.get(id) ?? null);
    }

    findByIdempotency(
        userId: string,
        threadId: string,
        clientRequestId: string,
    ): Promise<ChatExecutionEntity | null> {
        return Promise.resolve(
            [...this.rows.values()].find(
                (row) =>
                    row.userId === userId &&
                    row.threadId === threadId &&
                    row.clientRequestId === clientRequestId,
            ) ?? null,
        );
    }

    findLatestActiveByThread(threadId: string): Promise<ChatExecutionEntity | null> {
        return Promise.resolve(
            [...this.rows.values()]
                .filter(
                    (row) =>
                        row.threadId === threadId &&
                        (row.status === CHAT_EXECUTION_STATUS.queued ||
                            row.status === CHAT_EXECUTION_STATUS.running),
                )
                .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ??
                null,
        );
    }

    listActive(): Promise<ChatExecutionEntity[]> {
        return Promise.resolve(
            [...this.rows.values()]
                .filter(
                    (row) =>
                        row.status === CHAT_EXECUTION_STATUS.queued ||
                        row.status === CHAT_EXECUTION_STATUS.running,
                )
                .sort(compareOldest),
        );
    }

    listQueuedByThread(threadId: string): Promise<ChatExecutionEntity[]> {
        return Promise.resolve(
            [...this.rows.values()]
                .filter(
                    (row) =>
                        row.threadId === threadId && row.status === CHAT_EXECUTION_STATUS.queued,
                )
                .sort(compareOldest),
        );
    }

    listByThread(threadId: string, limit?: number): Promise<ChatExecutionEntity[]> {
        const rows = [...this.rows.values()]
                .filter((row) => row.threadId === threadId)
                .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        return Promise.resolve(limit === undefined ? rows : rows.slice(0, limit));
    }

    claimQueued(id: string, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.status !== CHAT_EXECUTION_STATUS.queued) return Promise.resolve(false);
        row.start(now);
        return Promise.resolve(true);
    }

    checkpointRunning(id: string, draftText: string, draftSeq: number, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.status !== CHAT_EXECUTION_STATUS.running || row.draftSeq >= draftSeq) {
            return Promise.resolve(false);
        }
        row.checkpoint(draftText, draftSeq, now);
        return Promise.resolve(true);
    }

    completeRunning(id: string, assistantMessageId: string, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.status !== CHAT_EXECUTION_STATUS.running) return Promise.resolve(false);
        row.complete(assistantMessageId, now);
        return Promise.resolve(true);
    }

    failActive(id: string, error: string, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.isTerminal()) return Promise.resolve(false);
        row.fail(error, now);
        return Promise.resolve(true);
    }

    cancelActive(id: string, now: Date): Promise<boolean> {
        const row = this.rows.get(id);
        if (row === undefined || row.isTerminal()) return Promise.resolve(false);
        row.cancel(now);
        return Promise.resolve(true);
    }

    insert(execution: ChatExecutionEntity): Promise<void> {
        const duplicate = [...this.rows.values()].some(
            (row) =>
                row.userId === execution.userId &&
                row.threadId === execution.threadId &&
                row.clientRequestId === execution.clientRequestId,
        );
        if (duplicate) return Promise.reject(Object.assign(new Error("duplicate"), { code: "23505" }));
        this.rows.set(execution.id, execution);
        return Promise.resolve();
    }

    upsert(execution: ChatExecutionEntity): Promise<void> {
        this.rows.set(execution.id, execution);
        return Promise.resolve();
    }

    deleteByThread(threadId: string): Promise<void> {
        for (const [id, row] of this.rows) {
            if (row.threadId === threadId) this.rows.delete(id);
        }
        return Promise.resolve();
    }
}

function compareOldest(left: ChatExecutionEntity, right: ChatExecutionEntity): number {
    return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}

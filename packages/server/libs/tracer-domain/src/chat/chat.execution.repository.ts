import { In, LessThan, type Repository } from "typeorm";
import { CHAT_EXECUTION_STATUS } from "./chat.const.js";
import type { ChatExecutionEntity } from "./chat.execution.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export class ChatExecutionRepository {
    constructor(private readonly repo: Repository<ChatExecutionEntity>) {}

    async findById(id: string): Promise<ChatExecutionEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByIdempotency(
        userId: string,
        threadId: string,
        clientRequestId: string,
    ): Promise<ChatExecutionEntity | null> {
        return this.repo.findOne({ where: { userId, threadId, clientRequestId } });
    }

    async findLatestActiveByThread(threadId: string): Promise<ChatExecutionEntity | null> {
        return this.repo.findOne({
            where: {
                threadId,
                status: In([CHAT_EXECUTION_STATUS.queued, CHAT_EXECUTION_STATUS.running]),
            },
            order: { createdAt: "DESC" },
        });
    }

    async listActive(): Promise<ChatExecutionEntity[]> {
        return this.repo.find({
            where: {
                status: In([CHAT_EXECUTION_STATUS.queued, CHAT_EXECUTION_STATUS.running]),
            },
            order: { createdAt: "ASC", id: "ASC" },
        });
    }

    async listQueuedByThread(threadId: string): Promise<ChatExecutionEntity[]> {
        return this.repo.find({
            where: { threadId, status: CHAT_EXECUTION_STATUS.queued },
            order: { createdAt: "ASC", id: "ASC" },
        });
    }

    async listByThread(threadId: string, limit?: number): Promise<ChatExecutionEntity[]> {
        return this.repo.find({
            where: { threadId },
            order: { createdAt: "DESC" },
            ...(limit !== undefined ? { take: limit } : {}),
        });
    }

    async claimQueued(id: string, now: Date): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: CHAT_EXECUTION_STATUS.queued },
            { status: CHAT_EXECUTION_STATUS.running, startedAt: now, updatedAt: now },
        );
        return result.affected === 1;
    }

    async checkpointRunning(
        id: string,
        draftText: string,
        draftSeq: number,
        now: Date,
    ): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: CHAT_EXECUTION_STATUS.running, draftSeq: LessThan(draftSeq) },
            { draftText, draftSeq, updatedAt: now },
        );
        return result.affected === 1;
    }

    async completeRunning(id: string, assistantMessageId: string, now: Date): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: CHAT_EXECUTION_STATUS.running },
            {
                status: CHAT_EXECUTION_STATUS.completed,
                assistantMessageId,
                completedAt: now,
                updatedAt: now,
            },
        );
        return result.affected === 1;
    }

    async failActive(id: string, error: string, now: Date): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: In([CHAT_EXECUTION_STATUS.queued, CHAT_EXECUTION_STATUS.running]) },
            { status: CHAT_EXECUTION_STATUS.failed, error, completedAt: now, updatedAt: now },
        );
        return result.affected === 1;
    }

    async cancelActive(id: string, now: Date): Promise<boolean> {
        const result = await this.repo.update(
            { id, status: In([CHAT_EXECUTION_STATUS.queued, CHAT_EXECUTION_STATUS.running]) },
            { status: CHAT_EXECUTION_STATUS.canceled, completedAt: now, updatedAt: now },
        );
        return result.affected === 1;
    }

    async insert(execution: ChatExecutionEntity): Promise<void> {
        await this.repo.insert(execution);
    }

    async upsert(execution: ChatExecutionEntity): Promise<void> {
        await upsertByKeys(this.repo, execution, ["id"]);
    }

    async deleteByThread(threadId: string): Promise<void> {
        await this.repo.delete({ threadId });
    }
}

import type { QueryDeepPartialEntity, Repository } from "typeorm";
import {
    JOB_STATUS,
    type JobKind,
    type JobStatus,
} from "@monitor/kernel";
import type { AiJobEntity } from "./ai.job.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

export interface AiJobHistoryQuery {
    readonly kind?: JobKind;
    readonly status?: JobStatus;
    readonly limit: number;
    readonly offset: number;
}

export interface AiJobHistoryPage {
    readonly items: readonly AiJobEntity[];
    readonly total: number;
}

export class AiJobRepository {
    constructor(private readonly repo: Repository<AiJobEntity>) {}

    async findById(id: string): Promise<AiJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findPending(kind: JobKind): Promise<AiJobEntity[]> {
        return this.repo.find({ where: { kind, status: JOB_STATUS.pending }, order: { createdAt: "ASC" } });
    }

    async findFailed(userId: string, limit: number): Promise<AiJobEntity[]> {
        return this.repo.find({
            where: { userId, status: JOB_STATUS.failed },
            order: { completedAt: "DESC" },
            take: limit,
        });
    }

    async findRecentByUser(userId: string, limit: number): Promise<AiJobEntity[]> {
        return this.repo.find({
            where: { userId },
            order: { createdAt: "DESC" },
            take: limit,
        });
    }

    async findHistoryByUser(userId: string, query: AiJobHistoryQuery): Promise<AiJobHistoryPage> {
        const [items, total] = await this.repo.findAndCount({
            where: {
                userId,
                ...(query.kind !== undefined ? { kind: query.kind } : {}),
                ...(query.status !== undefined ? { status: query.status } : {}),
            },
            order: { createdAt: "DESC" },
            take: query.limit,
            skip: query.offset,
        });
        return { items, total };
    }

    // 취소는 완료·실패와 경합하므로 조건부 UPDATE의 affected 수로 승자를 정하며, 읽고-쓰는 upsert로는 막을 수 없다.
    async transitionToCanceled(id: string, now: Date): Promise<boolean> {
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set({ status: JOB_STATUS.canceled, completedAt: now, updatedAt: now })
            .where("id = :id", { id })
            .andWhere("status IN (:...cancelable)", {
                cancelable: [JOB_STATUS.pending, JOB_STATUS.running],
            })
            .execute();
        return (result.affected ?? 0) > 0;
    }

    // 메모리에서 전이시킨 잡을 조건부 UPDATE로 커밋하며, 현재 상태가 from 에 없으면 경합에 져 false 를 반환한다.
    async commitTransition(job: AiJobEntity, from: readonly JobStatus[]): Promise<boolean> {
        const patch = {
            status: job.status,
            attempts: job.attempts,
            result: job.result,
            usage: job.usage,
            error: job.error,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            updatedAt: job.updatedAt,
            leaseOwner: job.leaseOwner,
            leaseExpiresAt: job.leaseExpiresAt,
        } as unknown as QueryDeepPartialEntity<AiJobEntity>;
        const result = await this.repo
            .createQueryBuilder()
            .update()
            .set(patch)
            .where("id = :id", { id: job.id })
            .andWhere("status IN (:...from)", { from })
            .execute();
        return (result.affected ?? 0) > 0;
    }

    async findLatest(userId: string, kind: JobKind, taskId?: string): Promise<AiJobEntity | null> {
        return this.repo.findOne({
            where: { userId, kind, ...(taskId !== undefined ? { taskId } : {}) },
            order: { createdAt: "DESC" },
        });
    }

    async findByIdempotency(userId: string, kind: JobKind, idempotencyKey: string): Promise<AiJobEntity | null> {
        return this.repo.findOne({ where: { userId, kind, idempotencyKey } });
    }

    async insert(job: AiJobEntity): Promise<void> {
        await this.repo.insert(job as unknown as QueryDeepPartialEntity<AiJobEntity>);
    }

    async upsert(job: AiJobEntity): Promise<void> {
        await upsertByKeys(this.repo, job, ["id"]);
    }

}

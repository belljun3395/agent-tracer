import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { ACTIVE_JOB_STATUSES, JOB_STATUS } from "@monitor/shared/job/job.status.const.js";
import {
    InsightJobEntity,
    type InsightJobType,
} from "@monitor/insight-api/domain/job/insight.job.entity.js";

@Injectable()
export class InsightJobRepository {
    constructor(
        @InjectRepository(InsightJobEntity)
        private readonly repo: Repository<InsightJobEntity>,
    ) {}

    insert(input: {
        id: string;
        jobType: InsightJobType;
        createdAt: string;
        filtersJson?: string | null;
        language?: string | null;
    }): Promise<InsightJobEntity> {
        const entity = this.repo.create({
            id: input.id,
            userId: currentUserId(),
            jobType: input.jobType,
            status: JOB_STATUS.pending,
            attempts: 0,
            error: null,
            filtersJson: input.filtersJson ?? null,
            language: input.language ?? null,
            candidatesCreated: null,
            suggestionsCreated: null,
            tasksScanned: null,
            modelUsed: null,
            durationMs: null,
            costUsd: null,
            inputTokens: null,
            outputTokens: null,
            cacheReadTokens: null,
            cacheCreationTokens: null,
            numTurns: null,
            llmOutputJson: null,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
            startedAt: null,
            completedAt: null,
        });
        return this.repo.save(entity);
    }

    findById(id: string): Promise<InsightJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async saveLlmOutput(
        id: string,
        llmOutputJson: string,
        updatedAt: string,
    ): Promise<void> {
        await this.repo.update({ id }, { llmOutputJson, updatedAt });
    }

    findActive(jobType: InsightJobType): Promise<InsightJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .andWhere("job.status IN (:...statuses)", {
                statuses: ACTIVE_JOB_STATUSES,
            })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    findLatest(jobType: InsightJobType): Promise<InsightJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    async markCompleted(input: {
        id: string;
        modelUsed: string;
        durationMs: number;
        completedAt: string;
        candidatesCreated?: number;
        suggestionsCreated?: number;
        tasksScanned?: number;
        costUsd?: number | null;
        numTurns?: number | null;
        usage?: {
            readonly inputTokens: number;
            readonly outputTokens: number;
            readonly cacheReadTokens: number;
            readonly cacheCreationTokens: number;
        } | null;
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: JOB_STATUS.completed,
                ...(input.candidatesCreated !== undefined
                    ? { candidatesCreated: input.candidatesCreated }
                    : {}),
                ...(input.suggestionsCreated !== undefined
                    ? { suggestionsCreated: input.suggestionsCreated }
                    : {}),
                ...(input.tasksScanned !== undefined
                    ? { tasksScanned: input.tasksScanned }
                    : {}),
                modelUsed: input.modelUsed,
                durationMs: input.durationMs,
                costUsd: input.costUsd ?? null,
                numTurns: input.numTurns ?? null,
                inputTokens: input.usage?.inputTokens ?? null,
                outputTokens: input.usage?.outputTokens ?? null,
                cacheReadTokens: input.usage?.cacheReadTokens ?? null,
                cacheCreationTokens: input.usage?.cacheCreationTokens ?? null,
                completedAt: input.completedAt,
                updatedAt: input.completedAt,
            },
        );
    }

    async markFailed(input: {
        id: string;
        error: string;
        attempts: number;
        completedAt: string;
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: JOB_STATUS.failed,
                error: input.error,
                attempts: input.attempts,
                completedAt: input.completedAt,
                updatedAt: input.completedAt,
            },
        );
    }

    async incrementAttempts(id: string, updatedAt: string): Promise<number> {
        const job = await this.findById(id);
        if (!job) return 0;
        const next = job.attempts + 1;
        await this.repo.update({ id }, { attempts: next, updatedAt });
        return next;
    }

    async incrementAndMarkFailed(input: {
        id: string;
        error: string;
        completedAt: string;
    }): Promise<void> {
        await this.repo.manager.transaction(async (em) => {
            const job = await em.findOne(InsightJobEntity, { where: { id: input.id } });
            const attempts = (job?.attempts ?? 0) + 1;
            await em.update(InsightJobEntity, { id: input.id }, {
                status: JOB_STATUS.failed,
                error: input.error,
                attempts,
                completedAt: input.completedAt,
                updatedAt: input.completedAt,
            });
        });
    }
}

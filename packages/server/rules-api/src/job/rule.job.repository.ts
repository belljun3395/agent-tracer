import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { ACTIVE_JOB_STATUSES, JOB_STATUS } from "@monitor/shared/job/job.status.const.js";
import {
    RuleJobEntity,
    type RuleJobType,
} from "./rule.job.entity.js";

@Injectable()
export class RuleJobRepository {
    constructor(
        @InjectRepository(RuleJobEntity)
        private readonly repo: Repository<RuleJobEntity>,
    ) {}

    insert(input: {
        id: string;
        jobType: RuleJobType;
        createdAt: string;
        taskId?: string | null;
        ruleId?: string | null;
    }): Promise<RuleJobEntity> {
        const entity = this.repo.create({
            id: input.id,
            userId: currentUserId(),
            jobType: input.jobType,
            status: JOB_STATUS.pending,
            attempts: 0,
            error: null,
            taskId: input.taskId ?? null,
            ruleId: input.ruleId ?? null,
            rulesCreated: null,
            verdictsCreated: null,
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

    findById(id: string): Promise<RuleJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    // LLM 응답을 저장해 재실행이 같은 호출을 다시 하지 않게 한다.
    async saveLlmOutput(
        id: string,
        llmOutputJson: string,
        updatedAt: string,
    ): Promise<void> {
        await this.repo.update({ id }, { llmOutputJson, updatedAt });
    }

    findActiveForTask(
        jobType: RuleJobType,
        taskId: string,
    ): Promise<RuleJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .andWhere("job.taskId = :taskId", { taskId })
            .andWhere("job.status IN (:...statuses)", {
                statuses: ACTIVE_JOB_STATUSES,
            })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    findActiveForRule(
        jobType: RuleJobType,
        ruleId: string,
    ): Promise<RuleJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .andWhere("job.ruleId = :ruleId", { ruleId })
            .andWhere("job.status IN (:...statuses)", {
                statuses: ACTIVE_JOB_STATUSES,
            })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    findLatestForTask(
        jobType: RuleJobType,
        taskId: string,
    ): Promise<RuleJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .andWhere("job.taskId = :taskId", { taskId })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    async markCompleted(input: {
        id: string;
        modelUsed: string;
        durationMs: number;
        completedAt: string;
        rulesCreated?: number;
        verdictsCreated?: number;
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
                ...(input.rulesCreated !== undefined
                    ? { rulesCreated: input.rulesCreated }
                    : {}),
                ...(input.verdictsCreated !== undefined
                    ? { verdictsCreated: input.verdictsCreated }
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
}

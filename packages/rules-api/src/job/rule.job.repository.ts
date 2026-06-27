import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { RuleJobEntity, type RuleJobType } from "./rule.job.entity.js";

/**
 * Repository for the rules context's `rule_jobs` outbox. Both rule job types
 * (rule generation / rule backfill) go through this one repository, scoped by
 * `jobType`.
 */
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
            status: "pending",
            attempts: 0,
            error: null,
            taskId: input.taskId ?? null,
            ruleId: input.ruleId ?? null,
            rulesCreated: null,
            verdictsCreated: null,
            modelUsed: null,
            durationMs: null,
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
                statuses: ["pending", "processing"],
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
                statuses: ["pending", "processing"],
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
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: "completed",
                ...(input.rulesCreated !== undefined
                    ? { rulesCreated: input.rulesCreated }
                    : {}),
                ...(input.verdictsCreated !== undefined
                    ? { verdictsCreated: input.verdictsCreated }
                    : {}),
                modelUsed: input.modelUsed,
                durationMs: input.durationMs,
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
                status: "failed",
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

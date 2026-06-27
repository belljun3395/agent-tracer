import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import {
    GovernanceJobEntity,
    type GovernanceJobType,
} from "./governance.job.entity.js";

/**
 * Shared repository for the unified `governance_jobs` outbox. All three
 * governance job types (recipe scan / rule generation / task cleanup) go
 * through this one repository, scoped by `jobType`. The atomic `claim` keeps
 * the single-UPDATE concurrency guarantee the separate repos had.
 */
@Injectable()
export class GovernanceJobRepository {
    constructor(
        @InjectRepository(GovernanceJobEntity)
        private readonly repo: Repository<GovernanceJobEntity>,
    ) {}

    insert(input: {
        id: string;
        jobType: GovernanceJobType;
        createdAt: string;
        taskId?: string | null;
        ruleId?: string | null;
        filtersJson?: string | null;
        language?: string | null;
    }): Promise<GovernanceJobEntity> {
        const entity = this.repo.create({
            id: input.id,
            userId: currentUserId(),
            jobType: input.jobType,
            status: "pending",
            attempts: 0,
            error: null,
            taskId: input.taskId ?? null,
            ruleId: input.ruleId ?? null,
            filtersJson: input.filtersJson ?? null,
            language: input.language ?? null,
            candidatesCreated: null,
            rulesCreated: null,
            suggestionsCreated: null,
            verdictsCreated: null,
            tasksScanned: null,
            modelUsed: null,
            durationMs: null,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
            startedAt: null,
            completedAt: null,
        });
        return this.repo.save(entity);
    }

    findById(id: string): Promise<GovernanceJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    findActive(jobType: GovernanceJobType): Promise<GovernanceJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .andWhere("job.status IN (:...statuses)", {
                statuses: ["pending", "processing"],
            })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    findActiveForTask(
        jobType: GovernanceJobType,
        taskId: string,
    ): Promise<GovernanceJobEntity | null> {
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
        jobType: GovernanceJobType,
        ruleId: string,
    ): Promise<GovernanceJobEntity | null> {
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

    findLatest(jobType: GovernanceJobType): Promise<GovernanceJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    findLatestForTask(
        jobType: GovernanceJobType,
        taskId: string,
    ): Promise<GovernanceJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .andWhere("job.taskId = :taskId", { taskId })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    findPending(
        jobType: GovernanceJobType,
        limit: number,
    ): Promise<readonly GovernanceJobEntity[]> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.jobType = :jobType", { jobType })
            .andWhere("job.userId = :userId", { userId: currentUserId() })
            .andWhere("job.status = :status", { status: "pending" })
            .orderBy("job.createdAt", "ASC")
            .limit(limit)
            .getMany();
    }

    /** Atomic claim — only one worker can transition a pending row to processing. */
    async claim(
        jobId: string,
        startedAt: string,
    ): Promise<GovernanceJobEntity | null> {
        const result = await this.repo
            .createQueryBuilder()
            .update(GovernanceJobEntity)
            .set({ status: "processing", startedAt, updatedAt: startedAt })
            .where("id = :id", { id: jobId })
            .andWhere("status = :pending", { pending: "pending" })
            .execute();
        if ((result.affected ?? 0) === 0) return null;
        return this.findById(jobId);
    }

    async markCompleted(input: {
        id: string;
        modelUsed: string;
        durationMs: number;
        completedAt: string;
        candidatesCreated?: number;
        rulesCreated?: number;
        suggestionsCreated?: number;
        verdictsCreated?: number;
        tasksScanned?: number;
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: "completed",
                ...(input.candidatesCreated !== undefined
                    ? { candidatesCreated: input.candidatesCreated }
                    : {}),
                ...(input.rulesCreated !== undefined
                    ? { rulesCreated: input.rulesCreated }
                    : {}),
                ...(input.suggestionsCreated !== undefined
                    ? { suggestionsCreated: input.suggestionsCreated }
                    : {}),
                ...(input.verdictsCreated !== undefined
                    ? { verdictsCreated: input.verdictsCreated }
                    : {}),
                ...(input.tasksScanned !== undefined
                    ? { tasksScanned: input.tasksScanned }
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

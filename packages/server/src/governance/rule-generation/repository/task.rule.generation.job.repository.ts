import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TaskRuleGenerationJobEntity } from "../domain/task.rule.generation.job.entity.js";

@Injectable()
export class TaskRuleGenerationJobRepository {
    constructor(
        @InjectRepository(TaskRuleGenerationJobEntity)
        private readonly repo: Repository<TaskRuleGenerationJobEntity>,
    ) {}

    async insert(input: {
        id: string;
        taskId: string;
        createdAt: string;
    }): Promise<TaskRuleGenerationJobEntity> {
        const entity = this.repo.create({
            id: input.id,
            taskId: input.taskId,
            status: "pending",
            attempts: 0,
            error: null,
            rulesCreated: 0,
            modelUsed: null,
            durationMs: null,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
            startedAt: null,
            completedAt: null,
        });
        return this.repo.save(entity);
    }

    async findById(id: string): Promise<TaskRuleGenerationJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findActiveForTask(
        taskId: string,
    ): Promise<TaskRuleGenerationJobEntity | null> {
        const row = await this.repo
            .createQueryBuilder("job")
            .where("job.taskId = :taskId", { taskId })
            .andWhere("job.status IN (:...statuses)", {
                statuses: ["pending", "processing"],
            })
            .orderBy("job.createdAt", "DESC")
            .getOne();
        return row;
    }

    async findLatestForTask(
        taskId: string,
    ): Promise<TaskRuleGenerationJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.taskId = :taskId", { taskId })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    async findPending(
        limit: number,
    ): Promise<readonly TaskRuleGenerationJobEntity[]> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.status = :status", { status: "pending" })
            .orderBy("job.createdAt", "ASC")
            .limit(limit)
            .getMany();
    }

    /**
     * Atomic claim — only one worker can transition a pending row to processing.
     * Returns the claimed row (with started_at filled) or null if someone else won.
     */
    async claim(
        jobId: string,
        startedAt: string,
    ): Promise<TaskRuleGenerationJobEntity | null> {
        const result = await this.repo
            .createQueryBuilder()
            .update(TaskRuleGenerationJobEntity)
            .set({
                status: "processing",
                startedAt,
                updatedAt: startedAt,
            })
            .where("id = :id", { id: jobId })
            .andWhere("status = :pending", { pending: "pending" })
            .execute();
        if ((result.affected ?? 0) === 0) return null;
        return this.findById(jobId);
    }

    async markCompleted(input: {
        id: string;
        rulesCreated: number;
        modelUsed: string;
        durationMs: number;
        completedAt: string;
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: "completed",
                rulesCreated: input.rulesCreated,
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

    async releaseClaim(
        id: string,
        updatedAt: string,
    ): Promise<void> {
        await this.repo.update(
            { id },
            { status: "pending", updatedAt, startedAt: null },
        );
    }
}

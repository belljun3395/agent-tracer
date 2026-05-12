import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TaskCleanupJobEntity } from "../domain/task.cleanup.job.entity.js";

@Injectable()
export class TaskCleanupJobRepository {
    constructor(
        @InjectRepository(TaskCleanupJobEntity)
        private readonly repo: Repository<TaskCleanupJobEntity>,
    ) {}

    async insert(input: { id: string; createdAt: string }): Promise<TaskCleanupJobEntity> {
        const entity = this.repo.create({
            id: input.id,
            status: "pending",
            attempts: 0,
            error: null,
            suggestionsCreated: 0,
            tasksScanned: 0,
            modelUsed: null,
            durationMs: null,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
            startedAt: null,
            completedAt: null,
        });
        return this.repo.save(entity);
    }

    async findById(id: string): Promise<TaskCleanupJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findActive(): Promise<TaskCleanupJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.status IN (:...statuses)", {
                statuses: ["pending", "processing"],
            })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    async findLatest(): Promise<TaskCleanupJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    async findPending(limit: number): Promise<readonly TaskCleanupJobEntity[]> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.status = :status", { status: "pending" })
            .orderBy("job.createdAt", "ASC")
            .limit(limit)
            .getMany();
    }

    async claim(
        jobId: string,
        startedAt: string,
    ): Promise<TaskCleanupJobEntity | null> {
        const result = await this.repo
            .createQueryBuilder()
            .update(TaskCleanupJobEntity)
            .set({ status: "processing", startedAt, updatedAt: startedAt })
            .where("id = :id", { id: jobId })
            .andWhere("status = :pending", { pending: "pending" })
            .execute();
        if ((result.affected ?? 0) === 0) return null;
        return this.findById(jobId);
    }

    async markCompleted(input: {
        id: string;
        suggestionsCreated: number;
        tasksScanned: number;
        modelUsed: string;
        durationMs: number;
        completedAt: string;
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: "completed",
                suggestionsCreated: input.suggestionsCreated,
                tasksScanned: input.tasksScanned,
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

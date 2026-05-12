import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RecipeScanJobEntity } from "../domain/recipe.scan.job.entity.js";

@Injectable()
export class RecipeScanJobRepository {
    constructor(
        @InjectRepository(RecipeScanJobEntity)
        private readonly repo: Repository<RecipeScanJobEntity>,
    ) {}

    async insert(input: {
        id: string;
        filtersJson: string;
        language: string | null;
        createdAt: string;
    }): Promise<RecipeScanJobEntity> {
        const entity = this.repo.create({
            id: input.id,
            status: "pending",
            attempts: 0,
            error: null,
            candidatesCreated: 0,
            tasksScanned: 0,
            filtersJson: input.filtersJson,
            language: input.language,
            modelUsed: null,
            durationMs: null,
            createdAt: input.createdAt,
            updatedAt: input.createdAt,
            startedAt: null,
            completedAt: null,
        });
        return this.repo.save(entity);
    }

    async findById(id: string): Promise<RecipeScanJobEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findActive(): Promise<RecipeScanJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .where("job.status IN (:...statuses)", {
                statuses: ["pending", "processing"],
            })
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    async findLatest(): Promise<RecipeScanJobEntity | null> {
        return this.repo
            .createQueryBuilder("job")
            .orderBy("job.createdAt", "DESC")
            .getOne();
    }

    async findPending(limit: number): Promise<readonly RecipeScanJobEntity[]> {
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
    ): Promise<RecipeScanJobEntity | null> {
        const result = await this.repo
            .createQueryBuilder()
            .update(RecipeScanJobEntity)
            .set({ status: "processing", startedAt, updatedAt: startedAt })
            .where("id = :id", { id: jobId })
            .andWhere("status = :pending", { pending: "pending" })
            .execute();
        if ((result.affected ?? 0) === 0) return null;
        return this.findById(jobId);
    }

    async markCompleted(input: {
        id: string;
        candidatesCreated: number;
        tasksScanned: number;
        modelUsed: string;
        durationMs: number;
        completedAt: string;
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: "completed",
                candidatesCreated: input.candidatesCreated,
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

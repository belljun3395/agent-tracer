import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
    TaskCleanupSuggestionEntity,
    type TaskCleanupSuggestionKind,
    type TaskCleanupSuggestionStatus,
} from "../domain/task.cleanup.suggestion.entity.js";

@Injectable()
export class TaskCleanupSuggestionRepository {
    constructor(
        @InjectRepository(TaskCleanupSuggestionEntity)
        private readonly repo: Repository<TaskCleanupSuggestionEntity>,
    ) {}

    async insertMany(rows: readonly {
        id: string;
        jobId: string;
        taskId: string;
        kind: TaskCleanupSuggestionKind;
        currentValue: string | null;
        proposedValue: string | null;
        rationale: string;
        createdAt: string;
    }[]): Promise<void> {
        if (rows.length === 0) return;
        const entities = rows.map((r) =>
            this.repo.create({
                id: r.id,
                jobId: r.jobId,
                taskId: r.taskId,
                kind: r.kind,
                currentValue: r.currentValue,
                proposedValue: r.proposedValue,
                rationale: r.rationale,
                status: "pending",
                error: null,
                createdAt: r.createdAt,
                resolvedAt: null,
            }),
        );
        await this.repo.save(entities);
    }

    async findById(id: string): Promise<TaskCleanupSuggestionEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async listByStatus(
        status: TaskCleanupSuggestionStatus,
    ): Promise<readonly TaskCleanupSuggestionEntity[]> {
        return this.repo
            .createQueryBuilder("s")
            .where("s.status = :status", { status })
            .orderBy("s.createdAt", "DESC")
            .getMany();
    }

    async listAll(): Promise<readonly TaskCleanupSuggestionEntity[]> {
        return this.repo
            .createQueryBuilder("s")
            .orderBy("s.createdAt", "DESC")
            .getMany();
    }

    async markResolved(input: {
        id: string;
        status: Exclude<TaskCleanupSuggestionStatus, "pending">;
        resolvedAt: string;
        error?: string | null;
    }): Promise<void> {
        await this.repo.update(
            { id: input.id },
            {
                status: input.status,
                resolvedAt: input.resolvedAt,
                error: input.error ?? null,
            },
        );
    }
}

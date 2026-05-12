import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
    RecipeCandidateEntity,
    type RecipeCandidateStatus,
} from "../domain/recipe.candidate.entity.js";

export interface InsertRecipeCandidateRow {
    readonly id: string;
    readonly jobId: string;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly stepsJson: string;
    readonly touchedFilesJson: string;
    readonly contributingSlicesJson: string;
    readonly rationale: string;
    readonly language: string | null;
    readonly parentRecipeId: string | null;
    readonly createdAt: string;
}

@Injectable()
export class RecipeCandidateRepository {
    constructor(
        @InjectRepository(RecipeCandidateEntity)
        private readonly repo: Repository<RecipeCandidateEntity>,
    ) {}

    async insertMany(rows: readonly InsertRecipeCandidateRow[]): Promise<void> {
        if (rows.length === 0) return;
        const entities = rows.map((r) =>
            this.repo.create({
                id: r.id,
                jobId: r.jobId,
                title: r.title,
                intent: r.intent,
                description: r.description,
                summaryMd: r.summaryMd,
                stepsJson: r.stepsJson,
                touchedFilesJson: r.touchedFilesJson,
                contributingSlicesJson: r.contributingSlicesJson,
                rationale: r.rationale,
                language: r.language,
                parentRecipeId: r.parentRecipeId,
                status: "pending",
                error: null,
                createdAt: r.createdAt,
                resolvedAt: null,
            }),
        );
        await this.repo.save(entities);
    }

    async findById(id: string): Promise<RecipeCandidateEntity | null> {
        return this.repo.findOne({ where: { id } });
    }

    async listByStatus(
        status: RecipeCandidateStatus,
    ): Promise<readonly RecipeCandidateEntity[]> {
        return this.repo
            .createQueryBuilder("c")
            .where("c.status = :status", { status })
            .orderBy("c.createdAt", "DESC")
            .getMany();
    }

    async listAll(): Promise<readonly RecipeCandidateEntity[]> {
        return this.repo
            .createQueryBuilder("c")
            .orderBy("c.createdAt", "DESC")
            .getMany();
    }

    async markResolved(input: {
        id: string;
        status: Exclude<RecipeCandidateStatus, "pending">;
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

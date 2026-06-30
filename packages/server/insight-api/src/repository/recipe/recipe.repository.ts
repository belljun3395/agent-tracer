import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { currentUserId } from "@monitor/shared/kernel/user/user.context.js";
import { RecipeEntity } from "@monitor/insight-api/domain/recipe/recipe.entity.js";
import type { RecipeStatus } from "@monitor/insight-api/domain/recipe/const/recipe.const.js";

export interface InsertRecipeRow {
    readonly id: string;
    readonly sourceCandidateId: string | null;
    readonly title: string;
    readonly intent: string;
    readonly description: string;
    readonly summaryMd: string;
    readonly stepsJson: string;
    readonly touchedFilesJson: string;
    readonly contributingSlicesJson: string;
    readonly rev: number;
    readonly parentRecipeId: string | null;
    readonly language: string | null;
    readonly createdAt: string;
}

@Injectable()
export class RecipeRepository {
    constructor(
        @InjectRepository(RecipeEntity)
        private readonly repo: Repository<RecipeEntity>,
    ) {}

    async insert(row: InsertRecipeRow): Promise<RecipeEntity> {
        const entity = this.repo.create({
            id: row.id,
            userId: currentUserId(),
            sourceCandidateId: row.sourceCandidateId,
            title: row.title,
            intent: row.intent,
            description: row.description,
            summaryMd: row.summaryMd,
            stepsJson: row.stepsJson,
            touchedFilesJson: row.touchedFilesJson,
            contributingSlicesJson: row.contributingSlicesJson,
            rev: row.rev,
            parentRecipeId: row.parentRecipeId,
            status: "active",
            appliedCount: 0,
            successCount: 0,
            language: row.language,
            createdAt: row.createdAt,
            updatedAt: row.createdAt,
        });
        return this.repo.save(entity);
    }

    async findById(id: string): Promise<RecipeEntity | null> {
        return this.repo.findOne({ where: { id, userId: currentUserId() } });
    }

    async listByStatus(
        status: RecipeStatus,
    ): Promise<readonly RecipeEntity[]> {
        return this.repo
            .createQueryBuilder("r")
            .where("r.user_id = :userId", { userId: currentUserId() })
            .andWhere("r.status = :status", { status })
            .orderBy("r.updatedAt", "DESC")
            .getMany();
    }

    async listAll(): Promise<readonly RecipeEntity[]> {
        return this.repo
            .createQueryBuilder("r")
            .where("r.user_id = :userId", { userId: currentUserId() })
            .orderBy("r.updatedAt", "DESC")
            .getMany();
    }

    async setStatus(
        id: string,
        status: RecipeStatus,
        updatedAt: string,
    ): Promise<boolean> {
        const result = await this.repo.update({ id, userId: currentUserId() }, { status, updatedAt });
        return (result.affected ?? 0) > 0;
    }

    async incrementAppliedCount(id: string, updatedAt: string): Promise<void> {
        await this.repo
            .createQueryBuilder()
            .update(RecipeEntity)
            .set({
                appliedCount: () => "applied_count + 1",
                updatedAt,
            })
            .where("id = :id", { id })
            .execute();
    }

    async incrementSuccessCount(id: string, updatedAt: string): Promise<void> {
        await this.repo
            .createQueryBuilder()
            .update(RecipeEntity)
            .set({
                successCount: () => "success_count + 1",
                updatedAt,
            })
            .where("id = :id", { id })
            .execute();
    }
}

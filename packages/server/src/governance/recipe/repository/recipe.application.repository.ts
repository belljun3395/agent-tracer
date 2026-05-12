import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
    RecipeApplicationEntity,
    type RecipeApplicationInjectedVia,
    type RecipeApplicationOutcome,
} from "../domain/recipe.application.entity.js";

@Injectable()
export class RecipeApplicationRepository {
    constructor(
        @InjectRepository(RecipeApplicationEntity)
        private readonly repo: Repository<RecipeApplicationEntity>,
    ) {}

    async insert(input: {
        id: string;
        recipeId: string;
        targetTaskId: string;
        injectedVia: RecipeApplicationInjectedVia;
        score: number | null;
        createdAt: string;
    }): Promise<RecipeApplicationEntity> {
        const entity = this.repo.create({
            id: input.id,
            recipeId: input.recipeId,
            targetTaskId: input.targetTaskId,
            injectedVia: input.injectedVia,
            score: input.score,
            outcome: null,
            createdAt: input.createdAt,
            resolvedAt: null,
        });
        return this.repo.save(entity);
    }

    async listByTaskId(
        targetTaskId: string,
    ): Promise<readonly RecipeApplicationEntity[]> {
        return this.repo
            .createQueryBuilder("a")
            .where("a.targetTaskId = :id", { id: targetTaskId })
            .orderBy("a.createdAt", "ASC")
            .getMany();
    }

    async listOpenByTaskId(
        targetTaskId: string,
    ): Promise<readonly RecipeApplicationEntity[]> {
        return this.repo
            .createQueryBuilder("a")
            .where("a.targetTaskId = :id", { id: targetTaskId })
            .andWhere("a.outcome IS NULL")
            .orderBy("a.createdAt", "ASC")
            .getMany();
    }

    async setOutcome(
        id: string,
        outcome: RecipeApplicationOutcome,
        resolvedAt: string,
    ): Promise<void> {
        await this.repo.update({ id }, { outcome, resolvedAt });
    }
}

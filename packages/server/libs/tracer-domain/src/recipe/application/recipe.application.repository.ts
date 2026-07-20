import { IsNull, type Repository } from "typeorm";
import type { RecipeApplicationEntity } from "./recipe.application.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class RecipeApplicationRepository {
    constructor(private readonly repo: Repository<RecipeApplicationEntity>) {}

    async findByRecipe(recipeId: string): Promise<RecipeApplicationEntity[]> {
        return this.repo.find({ where: { recipeId }, order: { createdAt: "DESC" } });
    }

    /** 아직 판정이 종결되지 않은 이력이며, 자기보고 여부와 무관하게 verdict 하나로 연다·닫는다. */
    async findOpenByTask(taskId: string): Promise<RecipeApplicationEntity[]> {
        return this.repo.find({ where: { taskId, verdict: IsNull() } });
    }

    async upsert(application: RecipeApplicationEntity): Promise<void> {
        await upsertByKeys(this.repo, application, ["id"]);
    }
}

import type { Repository } from "typeorm";
import type { RecipeApplicationEntity } from "./recipe.application.entity.js";
import { upsertByKeys } from "@monitor/tracer-domain/persistence/repository.upsert.js";

export class RecipeApplicationRepository {
    constructor(private readonly repo: Repository<RecipeApplicationEntity>) {}

    async findByRecipe(recipeId: string): Promise<RecipeApplicationEntity[]> {
        return this.repo.find({ where: { recipeId }, order: { createdAt: "DESC" } });
    }

    async findByTask(taskId: string): Promise<RecipeApplicationEntity[]> {
        return this.repo.find({ where: { taskId } });
    }

    async upsert(application: RecipeApplicationEntity): Promise<void> {
        await upsertByKeys(this.repo, application, ["id"]);
    }
}

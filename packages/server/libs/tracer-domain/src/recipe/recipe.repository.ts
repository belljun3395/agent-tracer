import { IsNull, type Repository } from "typeorm";
import type { RecipeStatus } from "@monitor/kernel";
import type { RecipeEntity } from "./recipe.entity.js";
import { upsertByKeys } from "../persistence/repository.upsert.js";

/** 소프트삭제된 레시피는 어떤 조회에도 잡히지 않는다. */
export class RecipeRepository {
    constructor(private readonly repo: Repository<RecipeEntity>) {}

    async findById(id: string): Promise<RecipeEntity | null> {
        return this.repo.findOne({ where: { id, deletedAt: IsNull() } });
    }

    async findByStatus(userId: string, status: RecipeStatus): Promise<RecipeEntity[]> {
        return this.repo.find({ where: { userId, status, deletedAt: IsNull() }, order: { updatedAt: "DESC" } });
    }

    async findByUser(userId: string): Promise<RecipeEntity[]> {
        return this.repo.find({ where: { userId, deletedAt: IsNull() }, order: { updatedAt: "DESC" } });
    }

    async upsert(recipe: RecipeEntity): Promise<void> {
        await upsertByKeys(this.repo, recipe, ["id"]);
    }
}

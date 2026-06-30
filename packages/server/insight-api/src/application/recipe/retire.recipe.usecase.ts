import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { RecipeRepository } from "@monitor/insight-api/repository/recipe/recipe.repository.js";
import type {
    RetireRecipeUseCaseIn,
    RetireRecipeUseCaseOut,
} from "@monitor/insight-api/application/recipe/dto/retire.recipe.usecase.dto.js";

@Injectable()
export class RetireRecipeUseCase {
    constructor(private readonly recipes: RecipeRepository) {}

    @Transactional()
    async execute(
        input: RetireRecipeUseCaseIn,
    ): Promise<RetireRecipeUseCaseOut> {
        const row = await this.recipes.findById(input.recipeId);
        if (!row) return { status: "not_found" };
        if (row.isRetired()) return { status: "already_retired" };
        const ok = await this.recipes.setStatus(
            row.id,
            "retired",
            new Date().toISOString(),
        );
        if (!ok) return { status: "not_found" };
        return { status: "retired" };
    }
}

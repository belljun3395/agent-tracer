import { Injectable } from "@nestjs/common";
import { RecipeRepository } from "../repository/recipe.repository.js";
import { recipeToDto } from "./dto/recipe.dto.mapper.js";
import type {
    ListRecipesUseCaseIn,
    ListRecipesUseCaseOut,
} from "./dto/list.recipes.usecase.dto.js";

@Injectable()
export class ListRecipesUseCase {
    constructor(private readonly recipes: RecipeRepository) {}

    async execute(
        input: ListRecipesUseCaseIn,
    ): Promise<ListRecipesUseCaseOut> {
        const scope = input.status ?? "active";
        const rows =
            scope === "all" ? await this.recipes.listAll() : await this.recipes.listByStatus(scope);
        return { recipes: rows.map(recipeToDto) };
    }
}

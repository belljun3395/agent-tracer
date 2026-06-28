import { Injectable } from "@nestjs/common";
import { RecipeMatchingService } from "../service/recipe.matching.service.js";

/** 프롬프트에 맞는 recipe를 매칭한다. */
@Injectable()
export class MatchRecipeUseCase {
    constructor(private readonly matching: RecipeMatchingService) {}

    async execute(input: Parameters<RecipeMatchingService["match"]>[0]) {
        return { matches: await this.matching.match(input) };
    }
}

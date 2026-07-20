import {buildRecipeBody} from "~runtime/domain/recipe/model/recipe.body.model.js";
import type {RecipeFetchPort} from "~runtime/domain/recipe/port/recipe.fetch.port.js";
import type {Fetched} from "~runtime/support/fetched.js";

/** recipeId로 서버에서 레시피를 받아 본문 전문을 내며 서버의 없음 확답과 접속 실패를 구분해 낸다. */
export class GetRecipeUsecase {
    constructor(private readonly fetcher: RecipeFetchPort) {}

    async execute(recipeId: string): Promise<Fetched<string>> {
        try {
            const fetched = await this.fetcher.fetch(recipeId);
            return fetched.kind === "found" ? {kind: "found", value: buildRecipeBody(fetched.value)} : fetched;
        } catch {
            return {kind: "unavailable"};
        }
    }
}

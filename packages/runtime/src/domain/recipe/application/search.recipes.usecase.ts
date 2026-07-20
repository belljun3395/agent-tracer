import type {RecipeSearchPort, RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";
import type {Fetched} from "~runtime/support/fetched.js";

const DEFAULT_LIMIT = 3;

export interface SearchRecipesInput {
    readonly query: string;
    readonly limit?: number;
}

/** 서버 검색 색인에 질의를 그대로 위임하며 접속 실패를 구분해 낸다. */
export class SearchRecipesUsecase {
    constructor(private readonly search: RecipeSearchPort) {}

    async execute(input: SearchRecipesInput): Promise<Fetched<readonly RecipeSearchResultItem[]>> {
        const query = input.query.trim();
        if (query === "") return {kind: "found", value: []};
        try {
            return await this.search.search(query, input.limit ?? DEFAULT_LIMIT);
        } catch {
            return {kind: "unavailable"};
        }
    }
}

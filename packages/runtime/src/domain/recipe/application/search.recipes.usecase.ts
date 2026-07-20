import type {RecipeSearchPort, RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";

const DEFAULT_LIMIT = 3;

export interface SearchRecipesInput {
    readonly query: string;
    readonly limit?: number;
}

/** 서버 검색 색인에 질의를 그대로 위임하며 조회 실패는 삼키고 빈 결과로 낸다. */
export class SearchRecipesUsecase {
    constructor(private readonly search: RecipeSearchPort) {}

    async execute(input: SearchRecipesInput): Promise<readonly RecipeSearchResultItem[]> {
        const query = input.query.trim();
        if (query === "") return [];
        try {
            return await this.search.search(query, input.limit ?? DEFAULT_LIMIT);
        } catch {
            return [];
        }
    }
}

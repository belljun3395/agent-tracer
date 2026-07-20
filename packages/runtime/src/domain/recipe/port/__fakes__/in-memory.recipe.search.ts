import type {RecipeSearchPort, RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";

export class InMemoryRecipeSearch implements RecipeSearchPort {
    calls: Array<{readonly query: string; readonly limit: number}> = [];
    private items: readonly RecipeSearchResultItem[] = [];
    private shouldFail = false;

    seed(items: readonly RecipeSearchResultItem[]): void {
        this.items = [...items];
    }

    /** 서버 조회가 실패하는 상황을 재현한다. */
    failNext(): void {
        this.shouldFail = true;
    }

    async search(query: string, limit: number): Promise<readonly RecipeSearchResultItem[]> {
        this.calls.push({query, limit});
        if (this.shouldFail) throw new Error("search failed");
        return this.items;
    }
}

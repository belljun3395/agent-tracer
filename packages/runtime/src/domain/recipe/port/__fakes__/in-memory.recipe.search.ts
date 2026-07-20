import type {RecipeSearchPort, RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";
import type {Fetched} from "~runtime/support/fetched.js";

export class InMemoryRecipeSearch implements RecipeSearchPort {
    calls: Array<{readonly query: string; readonly limit: number}> = [];
    private items: readonly RecipeSearchResultItem[] = [];
    private nextThrows = false;
    private nextUnavailable = false;

    seed(items: readonly RecipeSearchResultItem[]): void {
        this.items = [...items];
    }

    /** 서버 조회가 예외로 튀는 상황을 재현한다. */
    failNext(): void {
        this.nextThrows = true;
    }

    /** 서버 접속은 됐지만 확답을 못 받은 상황을 재현한다. */
    respondUnavailableNext(): void {
        this.nextUnavailable = true;
    }

    async search(query: string, limit: number): Promise<Fetched<readonly RecipeSearchResultItem[]>> {
        this.calls.push({query, limit});
        if (this.nextThrows) throw new Error("search failed");
        if (this.nextUnavailable) return {kind: "unavailable"};
        return {kind: "found", value: this.items};
    }
}

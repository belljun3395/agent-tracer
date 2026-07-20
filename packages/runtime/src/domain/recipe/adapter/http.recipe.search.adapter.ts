import {getJson} from "~runtime/config/http.js";
import type {RecipeSearchPort, RecipeSearchResultItem} from "~runtime/domain/recipe/port/recipe.search.port.js";
import {isRecord} from "~runtime/support/json.js";

const REQUEST_TIMEOUT_MS = 5000;

/** 레시피 검색을 캐시 없이 서버 색인에 매 호출 라이브로 위임한다. */
export class HttpRecipeSearchAdapter implements RecipeSearchPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async search(query: string, limit: number): Promise<readonly RecipeSearchResultItem[]> {
        const url = `${this.baseUrl}/api/v1/recipes/search?q=${encodeURIComponent(query)}&limit=${limit}`;
        const body = await getJson<Record<string, unknown>>(url, this.headers, REQUEST_TIMEOUT_MS);
        return body === null ? [] : extractItems(body);
    }
}

function extractItems(body: unknown): RecipeSearchResultItem[] {
    let source: unknown = body;
    if (isRecord(source) && "data" in source) source = source["data"];
    if (isRecord(source) && Array.isArray(source["items"])) source = source["items"];
    if (!Array.isArray(source)) return [];
    const items: RecipeSearchResultItem[] = [];
    for (const entry of source) {
        const item = toItem(entry);
        if (item) items.push(item);
    }
    return items;
}

function toItem(value: unknown): RecipeSearchResultItem | null {
    if (!isRecord(value)) return null;
    const recipeId = value["recipeId"];
    const title = value["title"];
    if (typeof recipeId !== "string" || typeof title !== "string") return null;
    const intent = value["intent"];
    const description = value["description"];
    const score = value["score"];
    return {
        recipeId,
        title,
        intent: typeof intent === "string" ? intent : "",
        description: typeof description === "string" ? description : "",
        score: typeof score === "number" ? score : 0,
    };
}

import * as fs from "node:fs";
import {ensureCacheDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import type {CachedRecipe} from "~runtime/domain/recipe/model/recipe.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";
import {isRecord} from "~runtime/support/json.js";

const RECIPES_ENDPOINT = "/api/v1/recipes?status=active";
const REQUEST_TIMEOUT_MS = 5000;

/** 활성 레시피를 서버에서 내려받아 홈 캐시 파일에 둔다. */
export class HttpRecipeCacheAdapter implements RecipeCachePort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
        private readonly paths: AgentTracerPaths = resolveAgentTracerPaths(),
    ) {}

    load(): readonly CachedRecipe[] {
        try {
            return extractRecipes(JSON.parse(fs.readFileSync(this.paths.recipesCachePath, "utf8")) as unknown);
        } catch {
            return [];
        }
    }

    async refresh(): Promise<boolean> {
        const response = await fetch(`${this.baseUrl}${RECIPES_ENDPOINT}`, {
            headers: this.headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) return false;
        const text = await response.text();
        const recipes = extractRecipes(text ? (JSON.parse(text) as unknown) : []);
        ensureCacheDir(this.paths);
        const tmp = `${this.paths.recipesCachePath}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({recipes}));
        fs.renameSync(tmp, this.paths.recipesCachePath);
        return true;
    }
}

function extractRecipes(body: unknown): CachedRecipe[] {
    let source: unknown = body;
    if (isRecord(source) && "data" in source) source = source["data"];
    if (isRecord(source) && Array.isArray(source["recipes"])) source = source["recipes"];
    if (!Array.isArray(source)) return [];
    const recipes: CachedRecipe[] = [];
    for (const item of source) {
        const recipe = toCachedRecipe(item);
        if (recipe) recipes.push(recipe);
    }
    return recipes;
}

function toCachedRecipe(value: unknown): CachedRecipe | null {
    if (!isRecord(value)) return null;
    const id = readString(value, "id") || readString(value, "recipeId");
    const title = readString(value, "title");
    if (!id || !title) return null;
    return {
        id,
        title,
        intent: readString(value, "intent"),
        description: readString(value, "description"),
        summaryMd: readString(value, "summaryMd"),
    };
}

function readString(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    return typeof value === "string" ? value : "";
}

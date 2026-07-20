import {getJson} from "~runtime/config/http.js";
import {ensureCacheDir, resolveAgentTracerPaths, type AgentTracerPaths} from "~runtime/config/home.paths.js";
import type {
    CachedRecipe,
    CachedRecipeCorrection,
    CachedRecipePitfall,
    CachedRecipeStep,
} from "~runtime/domain/recipe/model/recipe.model.js";
import type {RecipeCachePort} from "~runtime/domain/recipe/port/recipe.cache.port.js";
import {isRecord} from "~runtime/support/json.js";
import {readJsonFile, writeJsonFile} from "~runtime/support/json.file.store.js";

const RECIPES_ENDPOINT = "/api/v1/recipes?status=active";
const REQUEST_TIMEOUT_MS = 5000;

/** 활성 레시피 본문 전체를 서버에서 내려받아 홈 캐시 파일에 두며, 오프라인에서도 get_recipe가 이 캐시만 읽는다. */
export class HttpRecipeCacheAdapter implements RecipeCachePort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
        private readonly paths: AgentTracerPaths = resolveAgentTracerPaths(),
    ) {}

    load(): readonly CachedRecipe[] {
        const parsed = readJsonFile(this.paths.recipesCachePath, isRecord);
        return parsed === null ? [] : extractRecipes(parsed);
    }

    async refresh(): Promise<boolean> {
        const body = await getJson<Record<string, unknown>>(
            `${this.baseUrl}${RECIPES_ENDPOINT}`,
            this.headers,
            REQUEST_TIMEOUT_MS,
        );
        if (body === null) return false;
        const recipes = extractRecipes(body);
        ensureCacheDir(this.paths);
        writeJsonFile(this.paths.recipesCachePath, {recipes});
        return true;
    }
}

function extractRecipes(body: unknown): CachedRecipe[] {
    let source: unknown = body;
    if (isRecord(source) && "data" in source) source = source["data"];
    if (isRecord(source) && Array.isArray(source["items"])) source = source["items"];
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
    const id = readString(value, "id");
    const title = readString(value, "title");
    if (!id || !title) return null;
    return {
        id,
        title,
        intent: readString(value, "intent"),
        description: readString(value, "description"),
        summaryMd: readString(value, "summaryMd"),
        steps: readSteps(value["steps"]),
        pitfalls: readPitfalls(value["pitfalls"]),
        corrections: readCorrections(value["corrections"]),
        touchedFiles: readStringArray(value["touchedFiles"]),
        governingRules: readStringArray(value["governingRules"]),
    };
}

function readSteps(value: unknown): CachedRecipeStep[] {
    if (!Array.isArray(value)) return [];
    const steps: CachedRecipeStep[] = [];
    for (const entry of value) {
        if (!isRecord(entry)) continue;
        const order = entry["order"];
        const action = readString(entry, "action");
        if (typeof order !== "number" || !action) continue;
        const rationale = readString(entry, "rationale");
        steps.push({order, action, ...(rationale ? {rationale} : {})});
    }
    return steps;
}

function readPitfalls(value: unknown): CachedRecipePitfall[] {
    if (!Array.isArray(value)) return [];
    const pitfalls: CachedRecipePitfall[] = [];
    for (const entry of value) {
        if (!isRecord(entry)) continue;
        const pitfall = readString(entry, "pitfall");
        const whyNonObvious = readString(entry, "whyNonObvious");
        if (pitfall && whyNonObvious) pitfalls.push({pitfall, whyNonObvious});
    }
    return pitfalls;
}

function readCorrections(value: unknown): CachedRecipeCorrection[] {
    if (!Array.isArray(value)) return [];
    const corrections: CachedRecipeCorrection[] = [];
    for (const entry of value) {
        if (!isRecord(entry)) continue;
        const whatAgentDid = readString(entry, "whatAgentDid");
        const howCorrected = readString(entry, "howCorrected");
        if (whatAgentDid && howCorrected) corrections.push({whatAgentDid, howCorrected});
    }
    return corrections;
}

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
}

function readString(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    return typeof value === "string" ? value : "";
}

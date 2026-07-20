import {getJson} from "~runtime/config/http.js";
import type {
    CachedRecipe,
    CachedRecipeCorrection,
    CachedRecipePitfall,
    CachedRecipeStep,
    CachedRecipeTouchedFile,
} from "~runtime/domain/recipe/model/recipe.model.js";
import type {RecipeFetchPort} from "~runtime/domain/recipe/port/recipe.fetch.port.js";
import {isRecord} from "~runtime/support/json.js";

const REQUEST_TIMEOUT_MS = 5000;

/** 레시피 하나를 캐시 없이 서버에서 매 호출 직접 가져온다. */
export class HttpRecipeFetchAdapter implements RecipeFetchPort {
    constructor(
        private readonly baseUrl: string,
        private readonly headers: Record<string, string>,
    ) {}

    async fetch(recipeId: string): Promise<CachedRecipe | null> {
        const fetched = await getJson<Record<string, unknown>>(
            `${this.baseUrl}/api/v1/recipes/${encodeURIComponent(recipeId)}`,
            this.headers,
            REQUEST_TIMEOUT_MS,
        );
        if (fetched.kind !== "found") return null;
        const payload = "data" in fetched.value ? fetched.value["data"] : fetched.value;
        return toCachedRecipe(payload);
    }
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
        touchedFiles: readTouchedFiles(value["touchedFiles"]),
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

function readTouchedFiles(value: unknown): CachedRecipeTouchedFile[] {
    if (!Array.isArray(value)) return [];
    const files: CachedRecipeTouchedFile[] = [];
    for (const entry of value) {
        if (!isRecord(entry)) continue;
        const path = readString(entry, "path");
        const role = entry["role"];
        if (path && (role === "read" || role === "write" || role === "both")) files.push({path, role});
    }
    return files;
}

function readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === "string");
}

function readString(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    return typeof value === "string" ? value : "";
}

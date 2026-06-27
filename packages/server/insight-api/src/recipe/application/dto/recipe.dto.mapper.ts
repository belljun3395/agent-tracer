import type { RecipeCandidateEntity } from "../../domain/recipe.candidate.entity.js";
import type { RecipeEntity } from "../../domain/recipe.entity.js";
import type {
    RecipeCandidateDto,
    RecipeDto,
    RecipeSliceDto,
    RecipeStepDto,
    RecipeTouchedFileDto,
} from "./recipe.usecase.dto.js";

export function candidateToDto(
    row: RecipeCandidateEntity,
): RecipeCandidateDto {
    return {
        id: row.id,
        jobId: row.jobId,
        title: row.title,
        intent: row.intent,
        description: row.description,
        summaryMd: row.summaryMd,
        steps: parseSteps(row.stepsJson),
        touchedFiles: parseTouchedFiles(row.touchedFilesJson),
        contributingSlices: parseSlices(row.contributingSlicesJson),
        rationale: row.rationale,
        language: row.language,
        parentRecipeId: row.parentRecipeId,
        status: row.status,
        error: row.error,
        createdAt: row.createdAt,
        resolvedAt: row.resolvedAt,
    };
}

export function recipeToDto(row: RecipeEntity): RecipeDto {
    return {
        id: row.id,
        sourceCandidateId: row.sourceCandidateId,
        title: row.title,
        intent: row.intent,
        description: row.description,
        summaryMd: row.summaryMd,
        steps: parseSteps(row.stepsJson),
        touchedFiles: parseTouchedFiles(row.touchedFilesJson),
        contributingSlices: parseSlices(row.contributingSlicesJson),
        rev: row.rev,
        parentRecipeId: row.parentRecipeId,
        status: row.status,
        appliedCount: row.appliedCount,
        successCount: row.successCount,
        language: row.language,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

function parseSteps(raw: string): readonly RecipeStepDto[] {
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecipeStepDto[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        if (typeof rec.order !== "number" || typeof rec.action !== "string") continue;
        out.push({
            order: rec.order,
            action: rec.action,
            ...(typeof rec.rationale === "string" ? { rationale: rec.rationale } : {}),
        });
    }
    return out;
}

function parseTouchedFiles(raw: string): readonly RecipeTouchedFileDto[] {
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecipeTouchedFileDto[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        if (typeof rec.path !== "string") continue;
        const role = rec.role;
        if (role !== "read" && role !== "write" && role !== "both") continue;
        out.push({ path: rec.path, role });
    }
    return out;
}

function parseSlices(raw: string): readonly RecipeSliceDto[] {
    const parsed = safeJsonParse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: RecipeSliceDto[] = [];
    for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const rec = item as Record<string, unknown>;
        if (typeof rec.taskId !== "string") continue;
        const eventIdsRaw = rec.eventIds;
        const eventIds = Array.isArray(eventIdsRaw)
            ? eventIdsRaw.filter((e): e is string => typeof e === "string")
            : [];
        out.push({ taskId: rec.taskId, eventIds });
    }
    return out;
}

function safeJsonParse(raw: string): unknown {
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

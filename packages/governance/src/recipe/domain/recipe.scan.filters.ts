import type { RecipeOutputLanguage } from "../application/recipe.scan.prompt.js";
import type { TaskSnapshotArchivedScope } from "@monitor/work/task/public/iservice/task.snapshot.query.iservice.js";

export type RecipeScanStatusFilter = "completed" | "active" | "all";

/** Normalized, clamped snapshot of the filters a recipe scan runs with. */
export interface RecipeScanFiltersSnapshot {
    readonly statusFilter: RecipeScanStatusFilter;
    readonly since: string | null;
    readonly maxCandidates: number;
    readonly minEventCount: number;
    readonly archivedScope: TaskSnapshotArchivedScope;
}

export const DEFAULT_MAX_CANDIDATES = 10;
export const MAX_CANDIDATES_HARD_CAP = 30;
export const DEFAULT_MIN_EVENT_COUNT = 1;

const SUPPORTED_LANGUAGES: ReadonlySet<RecipeOutputLanguage> = new Set([
    "auto",
    "ko",
    "en",
    "ja",
    "zh",
]);

/** Clamp the requested candidate cap into [1, hard-cap], defaulting when invalid. */
export function clampMaxCandidates(raw: unknown): number {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_CANDIDATES;
    return Math.min(Math.max(Math.floor(n), 1), MAX_CANDIDATES_HARD_CAP);
}

/** Clamp the minimum event count to >= 1, defaulting when invalid. */
export function clampMinEventCount(raw: unknown): number {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MIN_EVENT_COUNT;
    return Math.max(Math.floor(n), 1);
}

/** Apply request input + defaults to produce a normalized filters snapshot. */
export function normalizeRecipeScanFilters(input: {
    readonly statusFilter?: RecipeScanStatusFilter;
    readonly since?: string | null;
    readonly maxCandidates?: number;
    readonly minEventCount?: number;
    readonly archivedScope?: TaskSnapshotArchivedScope;
}): RecipeScanFiltersSnapshot {
    return {
        statusFilter: input.statusFilter ?? "completed",
        since: input.since ?? null,
        maxCandidates: clampMaxCandidates(input.maxCandidates),
        minEventCount: clampMinEventCount(input.minEventCount),
        archivedScope: input.archivedScope ?? "active",
    };
}

/** Parse a persisted filters JSON snapshot, falling back to defaults on bad input. */
export function parseRecipeScanFilters(raw: string): RecipeScanFiltersSnapshot {
    try {
        const parsed = JSON.parse(raw) as Partial<RecipeScanFiltersSnapshot>;
        return normalizeRecipeScanFilters(parsed);
    } catch {
        return normalizeRecipeScanFilters({});
    }
}

/** Keep only the tasks that satisfy the scan's status + since filters. */
export function applyRecipeScanFilters<
    T extends { readonly status: string; readonly updatedAt: string },
>(tasks: readonly T[], filters: RecipeScanFiltersSnapshot): readonly T[] {
    return tasks.filter((t) => {
        if (filters.statusFilter !== "all") {
            if (filters.statusFilter === "completed" && t.status !== "completed") {
                return false;
            }
            if (
                filters.statusFilter === "active" &&
                t.status !== "running" &&
                t.status !== "waiting"
            ) {
                return false;
            }
        }
        if (filters.since && t.updatedAt < filters.since) return false;
        return true;
    });
}

/** Normalize a raw language setting to a supported recipe output language. */
export function normalizeRecipeLanguage(raw: string | null): RecipeOutputLanguage {
    if (!raw) return "auto";
    const trimmed = raw.trim().toLowerCase() as RecipeOutputLanguage;
    return SUPPORTED_LANGUAGES.has(trimmed) ? trimmed : "auto";
}

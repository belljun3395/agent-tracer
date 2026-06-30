import { normalizeOutputLanguage } from "@monitor/shared/llm/output.language.js";
import type { RecipeOutputLanguage } from "../agent/recipe.scan.prompt.js";
import { ARCHIVED_SCOPES } from "@monitor/run-api/public/task/iservice/task.snapshot.query.iservice.js";
import type { TaskSnapshotArchivedScope } from "@monitor/run-api/public/task/iservice/task.snapshot.query.iservice.js";

export type RecipeScanStatusFilter = "completed" | "active" | "all";

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

export const RECIPE_SCAN_STATUS_FILTERS = ["completed", "active", "all"] as const satisfies readonly RecipeScanStatusFilter[];
export const RECIPE_SCAN_ARCHIVED_SCOPES = ARCHIVED_SCOPES satisfies readonly TaskSnapshotArchivedScope[];

const RECIPE_SCAN_STATUS_FILTER_SET: ReadonlySet<string> = new Set(RECIPE_SCAN_STATUS_FILTERS);
const RECIPE_SCAN_ARCHIVED_SCOPE_SET: ReadonlySet<string> = new Set(RECIPE_SCAN_ARCHIVED_SCOPES);

export function clampMaxCandidates(raw: unknown): number {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    // 후보 수 입력이 잘못되면 기본값으로 되돌리고, 과도한 요청은 절대 상한으로 자른다.
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MAX_CANDIDATES;
    return Math.min(Math.max(Math.floor(n), 1), MAX_CANDIDATES_HARD_CAP);
}

export function clampMinEventCount(raw: unknown): number {
    const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
    // 최소 이벤트 수는 1 미만으로 내려가지 않게 해 빈 근거 태스크를 제외한다.
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_MIN_EVENT_COUNT;
    return Math.max(Math.floor(n), 1);
}

export function normalizeRecipeScanFilters(input: {
    readonly statusFilter?: unknown;
    readonly since?: unknown;
    readonly maxCandidates?: unknown;
    readonly minEventCount?: unknown;
    readonly archivedScope?: unknown;
}): RecipeScanFiltersSnapshot {
    return {
        statusFilter: normalizeRecipeScanStatusFilter(input.statusFilter),
        since: typeof input.since === "string" ? input.since : null,
        maxCandidates: clampMaxCandidates(input.maxCandidates),
        minEventCount: clampMinEventCount(input.minEventCount),
        archivedScope: normalizeArchivedScope(input.archivedScope),
    };
}

export function parseRecipeScanFilters(raw: string): RecipeScanFiltersSnapshot {
    try {
        const parsed: unknown = JSON.parse(raw);
        return normalizeRecipeScanFilters(isRecord(parsed) ? parsed : {});
    } catch {
        // 저장된 필터가 깨졌으면 잡을 실패시키지 않고 기본 스캔 정책으로 실행한다.
        return normalizeRecipeScanFilters({});
    }
}

export function applyRecipeScanFilters<
    T extends { readonly status: string; readonly updatedAt: string },
>(tasks: readonly T[], filters: RecipeScanFiltersSnapshot): readonly T[] {
    return tasks.filter((t) => {
        if (filters.statusFilter !== "all") {
            // completed 스캔은 완료된 작업만, active 스캔은 진행/대기 작업만 남긴다.
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
        // since가 있으면 그 시점 이후 갱신된 태스크만 스캔한다.
        if (filters.since && t.updatedAt < filters.since) return false;
        return true;
    });
}

export function normalizeRecipeLanguage(raw: string | null): RecipeOutputLanguage {
    return normalizeOutputLanguage(raw);
}

function normalizeRecipeScanStatusFilter(value: unknown): RecipeScanStatusFilter {
    return typeof value === "string" && isRecipeScanStatusFilter(value)
        ? value
        : "completed";
}

function normalizeArchivedScope(value: unknown): TaskSnapshotArchivedScope {
    return typeof value === "string" && isRecipeScanArchivedScope(value)
        ? value
        : "active";
}

function isRecipeScanStatusFilter(value: string): value is RecipeScanStatusFilter {
    return RECIPE_SCAN_STATUS_FILTER_SET.has(value);
}

function isRecipeScanArchivedScope(value: string): value is TaskSnapshotArchivedScope {
    return RECIPE_SCAN_ARCHIVED_SCOPE_SET.has(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

import type { TaskSnapshotArchivedScope } from "@monitor/run-api/task/public/iservice/task.snapshot.query.iservice.js";
import type { RecipeScanStatusFilter } from "@monitor/insight-api/recipe/domain/recipe.scan.filters.policy.js";

export type { RecipeScanStatusFilter, RecipeScanFiltersSnapshot } from "@monitor/insight-api/recipe/domain/recipe.scan.filters.policy.js";

export interface EnqueueRecipeScanInput {

    readonly statusFilter?: RecipeScanStatusFilter;

    readonly since?: string;

    readonly maxCandidates?: number;

    readonly minEventCount?: number;

    readonly archivedScope?: TaskSnapshotArchivedScope;
}

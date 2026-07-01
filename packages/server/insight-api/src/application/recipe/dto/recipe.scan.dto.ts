import type { TaskSnapshotArchivedScope } from "@monitor/run-api/public/task/iservice/task.snapshot.query.iservice.js";
import type { RecipeScanStatusFilter } from "@monitor/insight-api/domain/recipe/recipe.scan.filters.policy.js";

export interface EnqueueRecipeScanInput {

    readonly statusFilter?: RecipeScanStatusFilter;

    readonly since?: string;

    readonly maxCandidates?: number;

    readonly minEventCount?: number;

    readonly archivedScope?: TaskSnapshotArchivedScope;
}

import type { TaskSnapshotArchivedScope } from "@monitor/work-api/task/public/iservice/task.snapshot.query.iservice.js";
import type { RecipeScanStatusFilter } from "@monitor/governance-api/recipe/domain/recipe.scan.filters.js";

// Filter value-object types live in the domain layer; re-exported here so
// existing application/controller imports keep resolving.
export type { RecipeScanStatusFilter, RecipeScanFiltersSnapshot } from "@monitor/governance-api/recipe/domain/recipe.scan.filters.js";

export interface EnqueueRecipeScanInput {
    /**
     * Which task lifecycle states to include in the scan.
     *  - "completed": only completed tasks (default)
     *  - "active":    only running/waiting (rarely useful — included for symmetry)
     *  - "all":       both
     */
    readonly statusFilter?: RecipeScanStatusFilter;
    /** ISO timestamp lower bound on task `updatedAt`. */
    readonly since?: string;
    /** Maximum candidate recipes the agent may return. */
    readonly maxCandidates?: number;
    /** Tasks below this event count are skipped. Default 1 (allow single-event tasks per UC decision #3). */
    readonly minEventCount?: number;
    /** Archive scope passed to TaskSnapshotQuery. Default "active" (non-archived). */
    readonly archivedScope?: TaskSnapshotArchivedScope;
}

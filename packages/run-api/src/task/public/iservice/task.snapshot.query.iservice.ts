import type { DashboardSnapshot, TaskSnapshot, TaskStatus } from "../dto/task.snapshot.dto.js";

/**
 * Public iservice — bulk snapshot queries for the WS initial-snapshot payload
 * and stats. Consumed by the WS gateway (via a generic snapshot provider) to
 * build each connection's initial dashboard payload.
 */
export type TaskSnapshotArchivedScope = "active" | "archived" | "all";

export interface ITaskSnapshotQuery {
    findAll(scope?: TaskSnapshotArchivedScope): Promise<readonly TaskSnapshot[]>;
    listTaskStatuses(): Promise<readonly TaskStatus[]>;
    countTimelineEvents(): Promise<number>;
    /**
     * Composes the dashboard's initial snapshot (status tally + total event
     * count + task list) in one call, scoped to the current user. Replaces the
     * snapshot assembly that previously lived in the server bootstrap.
     */
    buildDashboardSnapshot(): Promise<DashboardSnapshot>;
}

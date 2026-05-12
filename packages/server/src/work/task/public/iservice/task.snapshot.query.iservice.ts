import type { TaskSnapshot, TaskStatus } from "../dto/task.snapshot.dto.js";

/**
 * Public iservice — bulk snapshot queries for the WS initial-snapshot payload
 * and stats. Used by bootstrap (composition root) and not consumed by other
 * feature modules.
 */
export type TaskSnapshotArchivedScope = "active" | "archived" | "all";

export interface ITaskSnapshotQuery {
    findAll(scope?: TaskSnapshotArchivedScope): Promise<readonly TaskSnapshot[]>;
    listTaskStatuses(): Promise<readonly TaskStatus[]>;
    countTimelineEvents(): Promise<number>;
}

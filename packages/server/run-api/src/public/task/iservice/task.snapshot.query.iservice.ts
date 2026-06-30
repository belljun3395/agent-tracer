import type { DashboardSnapshot, TaskSnapshot, TaskStatus } from "../dto/task.snapshot.dto.js";

export const ARCHIVED_SCOPES = ["active", "archived", "all"] as const;
export type TaskSnapshotArchivedScope = (typeof ARCHIVED_SCOPES)[number];

export interface ITaskSnapshotQuery {
    findAll(scope?: TaskSnapshotArchivedScope): Promise<readonly TaskSnapshot[]>;
    listTaskStatuses(): Promise<readonly TaskStatus[]>;
    countTimelineEvents(): Promise<number>;

    buildDashboardSnapshot(): Promise<DashboardSnapshot>;
}

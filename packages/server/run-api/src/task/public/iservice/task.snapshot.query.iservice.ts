import type { DashboardSnapshot, TaskSnapshot, TaskStatus } from "../dto/task.snapshot.dto.js";

export type TaskSnapshotArchivedScope = "active" | "archived" | "all";

export interface ITaskSnapshotQuery {
    findAll(scope?: TaskSnapshotArchivedScope): Promise<readonly TaskSnapshot[]>;
    listTaskStatuses(): Promise<readonly TaskStatus[]>;
    countTimelineEvents(): Promise<number>;

    buildDashboardSnapshot(): Promise<DashboardSnapshot>;
}

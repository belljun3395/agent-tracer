import type { MonitoringTask } from "~domain/monitoring/monitoring.task.model.js";
import type { MonitoringTaskKind } from "~domain/monitoring/task.status.type.js";

export interface TaskRow {
    id: string;
    title: string;
    slug: string;
    workspacePath: string | null;
    status: string;
    taskKind: string;
    parentTaskId: string | null;
    parentSessionId: string | null;
    backgroundTaskId: string | null;
    createdAt: string;
    updatedAt: string;
    lastSessionStartedAt: string | null;
    cliSource: string | null;
}

export function mapTaskRow(row: TaskRow): MonitoringTask {
    return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status as MonitoringTask["status"],
        taskKind: row.taskKind as MonitoringTaskKind,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        ...(row.workspacePath ? { workspacePath: row.workspacePath } : {}),
        ...(row.parentTaskId ? { parentTaskId: row.parentTaskId } : {}),
        ...(row.parentSessionId ? { parentSessionId: row.parentSessionId } : {}),
        ...(row.backgroundTaskId ? { backgroundTaskId: row.backgroundTaskId } : {}),
        ...(row.lastSessionStartedAt ? { lastSessionStartedAt: row.lastSessionStartedAt } : {}),
        ...(row.cliSource ? { runtimeSource: row.cliSource.trim() } : {}),
    };
}

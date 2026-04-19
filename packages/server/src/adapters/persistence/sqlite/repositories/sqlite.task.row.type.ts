import type { EventClassification } from "~domain/monitoring/timeline.event.model.js";
import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/event.kind.js";
import type { MonitoringTask } from "~domain/monitoring/monitoring.task.model.js";
import type { MonitoringTaskKind } from "~domain/monitoring/task.status.type.js";
import { parseJsonField } from "../shared/sqlite.json";

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

export interface EventKindRow {
    id: string;
    lane: string;
    kind: string;
    title: string;
    body: string | null;
    metadataJson: string;
    classificationJson: string;
    createdAt: string;
    taskId: string;
    sessionId: string | null;
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

export function mapEventKindRow(row: EventKindRow) {
    return {
        id: row.id,
        taskId: row.taskId,
        kind: row.kind as MonitoringEventKind,
        lane: row.lane as TimelineLane,
        title: row.title,
        metadata: parseJsonField<Record<string, unknown>>(row.metadataJson),
        classification: parseJsonField<EventClassification>(row.classificationJson),
        createdAt: row.createdAt,
        ...(row.sessionId ? { sessionId: row.sessionId } : {}),
        ...(row.body ? { body: row.body } : {}),
    };
}

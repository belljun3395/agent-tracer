import type { MonitoringSession } from "~domain/monitoring/monitoring.session.model.js";

export interface SessionRow {
    id: string;
    taskId: string;
    status: string;
    summary: string | null;
    startedAt: string;
    endedAt: string | null;
}

export function mapSessionRow(row: SessionRow): MonitoringSession {
    return {
        id: row.id,
        taskId: row.taskId,
        status: row.status as MonitoringSession["status"],
        startedAt: row.startedAt,
        ...(row.summary ? { summary: row.summary } : {}),
        ...(row.endedAt ? { endedAt: row.endedAt } : {}),
    };
}

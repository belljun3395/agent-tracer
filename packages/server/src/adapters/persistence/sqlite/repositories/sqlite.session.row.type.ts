import type { InferSelectModel } from "drizzle-orm";
import type { MonitoringSession } from "~domain/monitoring/index.js";
import type { sessionsCurrent } from "../schema/drizzle.schema.js";

export type SessionRow = InferSelectModel<typeof sessionsCurrent>;

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

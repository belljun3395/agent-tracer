import type { EventClassification, TimelineEvent } from "~domain/monitoring/timeline.event.model.js";
import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/event.kind.js";
import { normalizeLane } from "~domain/monitoring/task.factory.js";
import { parseJsonField } from "../shared/sqlite.json";

export interface EventRow {
    id: string;
    taskId: string;
    sessionId: string | null;
    kind: MonitoringEventKind;
    lane: TimelineLane;
    title: string;
    body: string | null;
    metadataJson: string;
    classificationJson: string;
    createdAt: string;
}

export function mapEventRow(row: EventRow): TimelineEvent {
    return {
        id: row.id,
        taskId: row.taskId,
        kind: row.kind,
        lane: normalizeLane(row.lane),
        title: row.title,
        metadata: parseJsonField<Record<string, unknown>>(row.metadataJson),
        classification: parseJsonField<EventClassification>(row.classificationJson),
        createdAt: row.createdAt,
        ...(row.sessionId ? { sessionId: row.sessionId } : {}),
        ...(row.body ? { body: row.body } : {}),
    };
}

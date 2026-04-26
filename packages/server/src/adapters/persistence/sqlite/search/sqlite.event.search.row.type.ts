import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/common/type/event.kind.type.js";
import type { MonitoringTask } from "~domain/monitoring/task/model/task.model.js";
import type { SearchDocumentScope } from "./sqlite.search.documents.js";

export interface SearchTaskRow {
    id: string;
    title: string;
    workspace_path: string | null;
    status: MonitoringTask["status"];
    updated_at: string;
}

export interface SearchEventRow {
    event_id: string;
    task_id: string;
    task_title: string;
    title: string;
    body: string | null;
    lane: TimelineLane;
    kind: MonitoringEventKind;
    created_at: string;
}

export interface SearchDocumentRow {
    scope: SearchDocumentScope;
    entity_id: string;
    task_id: string | null;
    search_text: string;
    embedding: string | null;
    updated_at: string;
}

export interface RankedSearchDocument {
    readonly row: SearchDocumentRow;
    readonly lexicalScore: number;
    readonly semanticScore: number | null;
}

import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/index.js";
import type { MonitoringTask } from "~domain/monitoring/index.js";
import type { SearchDocumentScope } from "../search/sqlite.search.documents.js";

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

export interface SearchBookmarkRow {
    id: string;
    task_id: string;
    event_id: string | null;
    kind: "task" | "event";
    title: string;
    note: string | null;
    created_at: string;
    task_title: string | null;
    event_title: string | null;
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

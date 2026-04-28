import type { MonitoringEventKind, TimelineLane } from "~event/domain/common/type/event.kind.type.js";
import type { TaskStatus } from "~task/common/task.status.type.js";
import type { SearchDocumentScope } from "./search.documents.js";

export interface SearchTaskRow {
    id: string;
    title: string;
    workspace_path: string | null;
    status: TaskStatus;
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

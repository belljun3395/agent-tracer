import type Database from "better-sqlite3";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { searchDocuments } from "./sqlite.search.tables.js";
export type SearchDocumentScope = "task" | "event";
export interface SearchDocumentInput {
    readonly scope: SearchDocumentScope;
    readonly entityId: string;
    readonly taskId?: string | null;
    readonly searchText: string;
    readonly updatedAt: string;
}
export function buildTaskSearchText(input: {
    readonly taskId: string;
    readonly title: string;
    readonly workspacePath?: string | null;
    readonly runtimeSource?: string | null;
}): string {
    return joinSearchTextParts([
        input.taskId,
        input.title,
        input.workspacePath,
        input.runtimeSource
    ]);
}
export function buildEventSearchText(input: {
    readonly taskTitle?: string | null;
    readonly title: string;
    readonly body?: string | null;
    readonly kind: string;
    readonly lane: string;
    readonly metadata?: Record<string, unknown>;
}): string {
    return joinSearchTextParts([
        input.taskTitle,
        input.title,
        input.body,
        input.kind,
        input.lane,
        flattenSearchableMetadata(input.metadata)
    ]);
}
export function upsertSearchDocument(db: SqliteDatabaseInput, input: SearchDocumentInput): void {
    const { orm } = ensureSqliteDatabase(db);
    orm.insert(searchDocuments).values({
        scope: input.scope,
        entityId: input.entityId,
        taskId: input.taskId ?? null,
        searchText: input.searchText,
        updatedAt: input.updatedAt
    }).onConflictDoUpdate({
        target: [searchDocuments.scope, searchDocuments.entityId],
        set: {
            taskId: input.taskId ?? null,
            searchText: input.searchText,
            updatedAt: input.updatedAt
        }
    }).run();
}
export function deleteSearchDocument(db: SqliteDatabaseInput, scope: SearchDocumentScope, entityId: string): void {
    const { orm } = ensureSqliteDatabase(db);
    orm.delete(searchDocuments)
        .where(and(eq(searchDocuments.scope, scope), eq(searchDocuments.entityId, entityId)))
        .run();
}
export function deleteSearchDocumentsByTaskIds(db: SqliteDatabaseInput, taskIds: readonly string[]): void {
    if (taskIds.length === 0) {
        return;
    }

    const { orm } = ensureSqliteDatabase(db);
    orm.delete(searchDocuments)
        .where(or(inArray(searchDocuments.taskId, taskIds), and(eq(searchDocuments.scope, "task"), inArray(searchDocuments.entityId, taskIds))))
        .run();
}
export function backfillSearchDocuments(db: Database.Database): void {
    const { orm } = ensureSqliteDatabase(db);

    orm.run(sql`
    insert into search_documents (scope, entity_id, task_id, search_text, updated_at)
    select
      'task',
      t.id,
      t.id,
      trim(t.id || ' ' || coalesce(t.title, '') || ' ' || coalesce(t.workspace_path, '') || ' ' || coalesce(t.cli_source, '')),
      t.updated_at
    from tasks_current t
    where not exists (
      select 1
      from search_documents s
      where s.scope = 'task' and s.entity_id = t.id
    );
  `);

    orm.run(sql`
    insert into search_documents (scope, entity_id, task_id, search_text, updated_at)
    select
      'event',
      e.id,
      e.task_id,
      trim(
        coalesce(t.title, '') || ' ' ||
        coalesce(e.title, '') || ' ' ||
        coalesce(e.body, '') || ' ' ||
        coalesce(e.kind, '') || ' ' ||
        coalesce(e.lane, '') || ' ' ||
        coalesce(e.subtype_key, '') || ' ' ||
        coalesce(e.subtype_label, '') || ' ' ||
        coalesce(e.subtype_group, '') || ' ' ||
        coalesce(e.tool_family, '') || ' ' ||
        coalesce(e.operation, '') || ' ' ||
        coalesce(e.source_tool, '') || ' ' ||
        coalesce(e.tool_name, '') || ' ' ||
        coalesce(e.entity_type, '') || ' ' ||
        coalesce(e.entity_name, '') || ' ' ||
        coalesce(e.display_title, '') || ' ' ||
        coalesce(e.extras_json, '')
      ),
      e.created_at
    from timeline_events_view e
    join tasks_current t on t.id = e.task_id
    where not exists (
      select 1
      from search_documents s
      where s.scope = 'event' and s.entity_id = e.id
    );
  `);

}
function joinSearchTextParts(parts: ReadonlyArray<string | null | undefined>): string {
    return parts
        .map((part) => part?.replace(/\s+/g, " ").trim())
        .filter((part): part is string => Boolean(part))
        .join(" ");
}
function flattenSearchableMetadata(value?: Record<string, unknown>, limit = 32): string {
    if (!value) {
        return "";
    }
    const fragments: string[] = [];
    collectMetadataFragments(value, fragments, limit);
    return fragments.join(" ");
}
function collectMetadataFragments(value: unknown, fragments: string[], limit: number): void {
    if (fragments.length >= limit || value == null) {
        return;
    }
    if (typeof value === "string") {
        const normalized = value.replace(/\s+/g, " ").trim();
        if (normalized) {
            fragments.push(normalized);
        }
        return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        fragments.push(String(value));
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectMetadataFragments(item, fragments, limit);
            if (fragments.length >= limit) {
                break;
            }
        }
        return;
    }
    if (typeof value === "object") {
        for (const item of Object.values(value)) {
            collectMetadataFragments(item, fragments, limit);
            if (fragments.length >= limit) {
                break;
            }
        }
    }
}

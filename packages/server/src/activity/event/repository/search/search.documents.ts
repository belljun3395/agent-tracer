import type { EntityManager } from "typeorm";
import { SearchDocumentEntity } from "~activity/event/domain/search/search.document.entity.js";

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
        input.runtimeSource,
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
        flattenSearchableMetadata(input.metadata),
    ]);
}

export async function upsertSearchDocument(manager: EntityManager, input: SearchDocumentInput): Promise<void> {
    const repo = manager.getRepository(SearchDocumentEntity);
    await repo
        .createQueryBuilder()
        .insert()
        .values({
            scope: input.scope,
            entityId: input.entityId,
            taskId: input.taskId ?? null,
            searchText: input.searchText,
            updatedAt: input.updatedAt,
        })
        .orUpdate(["task_id", "search_text", "updated_at"], ["scope", "entity_id"])
        .execute();
}

export async function deleteSearchDocument(
    manager: EntityManager,
    scope: SearchDocumentScope,
    entityId: string,
): Promise<void> {
    await manager.getRepository(SearchDocumentEntity).delete({ scope, entityId });
}

export async function deleteSearchDocumentsByTaskIds(
    manager: EntityManager,
    taskIds: readonly string[],
): Promise<void> {
    if (taskIds.length === 0) return;
    const placeholders = taskIds.map(() => "?").join(", ");
    await manager.query(
        `delete from search_documents
         where task_id in (${placeholders})
            or (scope = 'task' and entity_id in (${placeholders}))`,
        [...taskIds, ...taskIds],
    );
}

const BACKFILL_TASKS_SQL = `
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
  )
`;

const BACKFILL_EVENTS_SQL = `
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
  )
`;

export async function backfillSearchDocuments(manager: EntityManager): Promise<void> {
    await manager.query(BACKFILL_TASKS_SQL);
    await manager.query(BACKFILL_EVENTS_SQL);
}

function joinSearchTextParts(parts: ReadonlyArray<string | null | undefined>): string {
    return parts
        .map((part) => part?.replace(/\s+/g, " ").trim())
        .filter((part): part is string => Boolean(part))
        .join(" ");
}

function flattenSearchableMetadata(value?: Record<string, unknown>, limit = 32): string {
    if (!value) return "";
    const fragments: string[] = [];
    collectMetadataFragments(value, fragments, limit);
    return fragments.join(" ");
}

function collectMetadataFragments(value: unknown, fragments: string[], limit: number): void {
    if (fragments.length >= limit || value == null) return;
    if (typeof value === "string") {
        const normalized = value.replace(/\s+/g, " ").trim();
        if (normalized) fragments.push(normalized);
        return;
    }
    if (typeof value === "number" || typeof value === "boolean") {
        fragments.push(String(value));
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            collectMetadataFragments(item, fragments, limit);
            if (fragments.length >= limit) break;
        }
        return;
    }
    if (typeof value === "object") {
        for (const item of Object.values(value)) {
            collectMetadataFragments(item, fragments, limit);
            if (fragments.length >= limit) break;
        }
    }
}

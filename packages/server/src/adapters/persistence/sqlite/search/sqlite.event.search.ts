import type Database from "better-sqlite3";
import { normalizeLane } from "~domain/monitoring/task.factory.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";
import type { SearchBookmarkHit, SearchEventHit, SearchOptions, SearchResults, SearchTaskHit } from "~application/ports/repository/event.repository.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { normalizeSearchText } from "../shared/text.normalizers.js";
import { cosineSimilarity, deserializeEmbedding, serializeEmbedding } from "../shared/embedding.codec.js";
import { parseJsonField } from "../shared/sqlite.json";
import { buildEventSearchText, type SearchDocumentScope, upsertSearchDocument } from "./sqlite.search.documents.js";
import type {
    RankedSearchDocument,
    SearchBookmarkRow,
    SearchDocumentRow,
    SearchEventRow,
    SearchTaskRow,
} from "./sqlite.event.search.row.type.js";

const MIN_SEMANTIC_SCORE = 0.22;
const SEARCH_EMBEDDING_BACKFILL_THRESHOLD = 200;

export async function searchEvents(
    db: Database.Database,
    embeddingService: IEmbeddingService | undefined,
    query: string,
    opts?: SearchOptions,
): Promise<SearchResults> {
    const safeLimit = Math.max(1, Math.min(50, opts?.limit ?? 8));
    const taskId = opts?.taskId ?? null;
    const taskDocuments = loadSearchDocuments(db, "task");
    const eventDocuments = loadSearchDocuments(db, "event", taskId);
    const bookmarkDocuments = loadSearchDocuments(db, "bookmark", taskId);

    if (taskDocuments.length === 0 && eventDocuments.length === 0 && bookmarkDocuments.length === 0) {
        return legacySearch(db, query, opts);
    }

    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return { tasks: [], events: [], bookmarks: [] };
    }

    let queryVector: Float32Array | null = null;
    if (embeddingService) {
        try {
            await Promise.all([
                ensureSearchEmbeddings(db, embeddingService, taskDocuments),
                ensureSearchEmbeddings(db, embeddingService, eventDocuments),
                ensureSearchEmbeddings(db, embeddingService, bookmarkDocuments),
            ]);
            queryVector = await embeddingService.embed(query);
        }
        catch (error) {
            console.warn("[monitor-server] semantic global search failed; falling back to lexical search:", error instanceof Error ? error.message : error);
        }
    }

    const rankedTasks = rankSearchDocuments(taskDocuments, normalizedQuery, queryVector, safeLimit);
    const rankedEvents = rankSearchDocuments(eventDocuments, normalizedQuery, queryVector, safeLimit);
    const rankedBookmarks = rankSearchDocuments(bookmarkDocuments, normalizedQuery, queryVector, safeLimit);

    return {
        tasks: hydrateTaskHits(db, rankedTasks.map((row) => row.entity_id)),
        events: hydrateEventHits(db, rankedEvents.map((row) => row.entity_id)),
        bookmarks: hydrateBookmarkHits(db, rankedBookmarks.map((row) => row.entity_id)),
    };
}

export function refreshEventSearchDocument(db: SqliteDatabaseInput, eventId: string): void {
    const row = ensureSqliteDatabase(db).orm.query.timelineEvents.findFirst({
        columns: {
            id: true,
            taskId: true,
            title: true,
            body: true,
            lane: true,
            kind: true,
            metadataJson: true,
            createdAt: true
        },
        with: {
            task: {
                columns: {
                    title: true
                }
            }
        },
        where: (fields, operators) => operators.eq(fields.id, eventId)
    }).sync();

    if (!row?.task) {
        return;
    }

    upsertSearchDocument(db, {
        scope: "event",
        entityId: row.id,
        taskId: row.taskId,
        searchText: buildEventSearchText({
            taskTitle: row.task.title,
            title: row.title,
            body: row.body,
            kind: row.kind,
            lane: row.lane,
            metadata: parseJsonField<Record<string, unknown>>(row.metadataJson),
        }),
        updatedAt: row.createdAt,
    });
}

function loadSearchDocuments(
    db: Database.Database,
    scope: SearchDocumentScope,
    taskId?: string | null,
): readonly SearchDocumentRow[] {
    return db
        .prepare<{
            scope: SearchDocumentScope;
            taskId: string | null;
        }, SearchDocumentRow>(`
            select scope, entity_id, task_id, search_text, embedding, updated_at
            from search_documents
            where scope = @scope
              and (@taskId is null or scope = 'task' or task_id = @taskId)
        `)
        .all({ scope, taskId: taskId ?? null });
}

async function ensureSearchEmbeddings(
    db: Database.Database,
    embeddingService: IEmbeddingService,
    rows: readonly SearchDocumentRow[],
): Promise<void> {
    if (rows.length === 0 || rows.length > SEARCH_EMBEDDING_BACKFILL_THRESHOLD) {
        return;
    }
    for (const row of rows) {
        if (row.embedding || !row.search_text.trim()) {
            continue;
        }
        try {
            const vector = await embeddingService.embed(row.search_text);
            const serialized = serializeEmbedding(vector);
            db.prepare(`
                update search_documents
                set embedding = @embedding,
                    embedding_model = @embeddingModel
                where scope = @scope and entity_id = @entityId
            `).run({
                scope: row.scope,
                entityId: row.entity_id,
                embedding: serialized,
                embeddingModel: embeddingService.modelId,
            });
            (row as { embedding: string | null }).embedding = serialized;
        }
        catch (error) {
            if (isClosedDatabaseError(error)) {
                return;
            }
            console.warn("[monitor-server] search document embedding failed:", error instanceof Error ? error.message : error);
            return;
        }
    }
}

function hydrateTaskHits(db: Database.Database, taskIds: readonly string[]): readonly SearchTaskHit[] {
    if (taskIds.length === 0) {
        return [];
    }
    const placeholders = taskIds.map(() => "?").join(", ");
    const rows = db
        .prepare<string[], SearchTaskRow>(`
            select id, title, workspace_path, status, updated_at
            from tasks_current
            where id in (${placeholders})
        `)
        .all(...taskIds);
    const rowById = new Map(rows.map((row) => [row.id, row] as const));
    return taskIds.flatMap((taskId) => {
        const row = rowById.get(taskId);
        if (!row) {
            return [];
        }
        return [{
            id: row.id,
            taskId: row.id,
            title: row.title,
            status: row.status,
            updatedAt: row.updated_at,
            ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
        }];
    });
}

function hydrateEventHits(db: Database.Database, eventIds: readonly string[]): readonly SearchEventHit[] {
    if (eventIds.length === 0) {
        return [];
    }
    const placeholders = eventIds.map(() => "?").join(", ");
    const rows = db
        .prepare<string[], SearchEventRow>(`
            select e.id as event_id, e.task_id, t.title as task_title, e.title, e.body, e.lane, e.kind, e.created_at
            from timeline_events_view e
            join tasks_current t on t.id = e.task_id
            where e.id in (${placeholders})
        `)
        .all(...eventIds);
    const rowById = new Map(rows.map((row) => [row.event_id, row] as const));
    return eventIds.flatMap((eventId) => {
        const row = rowById.get(eventId);
        if (!row) {
            return [];
        }
        return [{
            id: row.event_id,
            eventId: row.event_id,
            taskId: row.task_id,
            taskTitle: row.task_title,
            title: row.title,
            lane: normalizeLane(row.lane),
            kind: row.kind,
            createdAt: row.created_at,
            ...(row.body ? { snippet: row.body } : {}),
        }];
    });
}

function hydrateBookmarkHits(db: Database.Database, bookmarkIds: readonly string[]): readonly SearchBookmarkHit[] {
    if (bookmarkIds.length === 0) {
        return [];
    }
    const placeholders = bookmarkIds.map(() => "?").join(", ");
    const rows = db
        .prepare<string[], SearchBookmarkRow>(`
            select b.id, b.task_id, b.event_id, b.kind, b.title, b.note, b.created_at, t.title as task_title, e.title as event_title
            from bookmarks_current b
            join tasks_current t on t.id = b.task_id
            left join timeline_events_view e on e.id = b.event_id
            where b.id in (${placeholders})
        `)
        .all(...bookmarkIds);
    const rowById = new Map(rows.map((row) => [row.id, row] as const));
    return bookmarkIds.flatMap((bookmarkId) => {
        const row = rowById.get(bookmarkId);
        if (!row) {
            return [];
        }
        return [{
            id: row.id,
            bookmarkId: row.id,
            taskId: row.task_id,
            kind: row.kind,
            title: row.title,
            createdAt: row.created_at,
            ...(row.event_id ? { eventId: row.event_id } : {}),
            ...(row.note ? { note: row.note } : {}),
            ...(row.task_title ? { taskTitle: row.task_title } : {}),
            ...(row.event_title ? { eventTitle: row.event_title } : {}),
        }];
    });
}

function legacySearch(db: Database.Database, query: string, opts?: SearchOptions): SearchResults {
    const pattern = `%${escapeLikePattern(query.trim().toLowerCase())}%`;
    const safeLimit = Math.max(1, Math.min(50, opts?.limit ?? 8));
    const taskId = opts?.taskId ?? null;

    const tasks = db
        .prepare<{
            pattern: string;
            limit: number;
        }, SearchTaskRow>(`
            select id, title, workspace_path, status, updated_at
            from tasks_current
            where lower(title) like @pattern escape '\\'
               or lower(coalesce(workspace_path, '')) like @pattern escape '\\'
            order by datetime(updated_at) desc
            limit @limit
        `)
        .all({ pattern, limit: safeLimit })
        .map((row) => ({
            id: row.id,
            taskId: row.id,
            title: row.title,
            status: row.status,
            updatedAt: row.updated_at,
            ...(row.workspace_path ? { workspacePath: row.workspace_path } : {}),
        }));

    const events = db
        .prepare<{
            pattern: string;
            limit: number;
            taskId: string | null;
        }, SearchEventRow>(`
            select e.id as event_id, e.task_id, t.title as task_title, e.title, e.body, e.lane, e.kind, e.created_at
            from timeline_events_view e
            join tasks_current t on t.id = e.task_id
            where (lower(e.title) like @pattern escape '\\' or lower(coalesce(e.body, '')) like @pattern escape '\\' or lower(e.metadata_json) like @pattern escape '\\')
              and (@taskId is null or e.task_id = @taskId)
            order by datetime(e.created_at) desc
            limit @limit
        `)
        .all({ pattern, limit: safeLimit, taskId })
        .map((row) => ({
            id: row.event_id,
            eventId: row.event_id,
            taskId: row.task_id,
            taskTitle: row.task_title,
            title: row.title,
            lane: normalizeLane(row.lane),
            kind: row.kind,
            createdAt: row.created_at,
            ...(row.body ? { snippet: row.body } : {}),
        }));

    const bookmarks = db
        .prepare<{
            pattern: string;
            limit: number;
            taskId: string | null;
        }, SearchBookmarkRow>(`
            select b.id, b.task_id, b.event_id, b.kind, b.title, b.note, b.created_at, t.title as task_title, e.title as event_title
            from bookmarks_current b
            join tasks_current t on t.id = b.task_id
            left join timeline_events_view e on e.id = b.event_id
            where (lower(b.title) like @pattern escape '\\' or lower(coalesce(b.note, '')) like @pattern escape '\\' or lower(t.title) like @pattern escape '\\' or lower(coalesce(e.title, '')) like @pattern escape '\\')
              and (@taskId is null or b.task_id = @taskId)
            order by datetime(b.created_at) desc
            limit @limit
        `)
        .all({ pattern, limit: safeLimit, taskId })
        .map((row) => ({
            id: row.id,
            bookmarkId: row.id,
            taskId: row.task_id,
            kind: row.kind,
            title: row.title,
            createdAt: row.created_at,
            ...(row.event_id ? { eventId: row.event_id } : {}),
            ...(row.note ? { note: row.note } : {}),
            ...(row.task_title ? { taskTitle: row.task_title } : {}),
            ...(row.event_title ? { eventTitle: row.event_title } : {}),
        }));

    return { tasks, events, bookmarks };
}

function rankSearchDocuments(
    rows: readonly SearchDocumentRow[],
    normalizedQuery: string,
    queryVector: Float32Array | null,
    limit: number,
): readonly SearchDocumentRow[] {
    const lexicalMatches = scoreLexicalMatches(rows, normalizedQuery);
    const semanticMatches = queryVector ? scoreSemanticMatches(rows, queryVector) : [];
    const ranked = new Map<string, RankedSearchDocument>();
    for (const semantic of semanticMatches) {
        ranked.set(semantic.row.entity_id, {
            row: semantic.row,
            lexicalScore: 0,
            semanticScore: semantic.score,
        });
    }
    for (const lexical of lexicalMatches) {
        const existing = ranked.get(lexical.row.entity_id);
        if (existing) {
            ranked.set(lexical.row.entity_id, {
                ...existing,
                lexicalScore: Math.max(existing.lexicalScore, lexical.score),
            });
            continue;
        }
        ranked.set(lexical.row.entity_id, {
            row: lexical.row,
            lexicalScore: lexical.score,
            semanticScore: null,
        });
    }
    return [...ranked.values()]
        .sort((left, right) => combinedRankScore(right) - combinedRankScore(left)
            || compareSearchDocumentRows(right.row, left.row))
        .slice(0, limit)
        .map((entry) => entry.row);
}

function scoreLexicalMatches(
    rows: readonly SearchDocumentRow[],
    normalizedQuery: string,
): readonly { row: SearchDocumentRow; score: number }[] {
    const queryTokens = tokenizeText(normalizedQuery);
    return rows
        .map((row) => ({
            row,
            score: computeLexicalScore(row.search_text, normalizedQuery, queryTokens),
        }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score
            || compareSearchDocumentRows(right.row, left.row));
}

function scoreSemanticMatches(
    rows: readonly SearchDocumentRow[],
    queryVector: Float32Array,
): readonly { row: SearchDocumentRow; score: number }[] {
    return rows
        .filter((row) => row.embedding)
        .map((row) => ({
            row,
            score: cosineSimilarity(queryVector, deserializeEmbedding(row.embedding as string)),
        }))
        .filter((entry) => entry.score >= MIN_SEMANTIC_SCORE)
        .sort((left, right) => right.score - left.score
            || compareSearchDocumentRows(right.row, left.row));
}

function computeLexicalScore(value: string, normalizedQuery: string, queryTokens: readonly string[]): number {
    const normalizedValue = normalizeSearchText(value);
    if (!normalizedValue) {
        return 0;
    }
    let score = 0;
    const matchedTokens = new Set<string>();
    if (normalizedValue.includes(normalizedQuery)) {
        score += 18;
    }
    for (const token of queryTokens) {
        if (!normalizedValue.includes(token)) {
            continue;
        }
        matchedTokens.add(token);
        score += 6;
    }
    if (queryTokens.length > 1 && matchedTokens.size === queryTokens.length) {
        score += queryTokens.length * 4;
    }
    return score;
}

function combinedRankScore(entry: RankedSearchDocument): number {
    return (entry.semanticScore ?? 0) * 100 + entry.lexicalScore;
}

function compareSearchDocumentRows(left: SearchDocumentRow, right: SearchDocumentRow): number {
    return Date.parse(left.updated_at) - Date.parse(right.updated_at);
}


function tokenizeText(value: string): readonly string[] {
    const seen = new Set<string>();
    const tokens: string[] = [];
    for (const rawToken of value.split(/[^\p{L}\p{N}]+/u)) {
        const token = rawToken.trim();
        if (!token || seen.has(token)) {
            continue;
        }
        seen.add(token);
        tokens.push(token);
    }
    return tokens.length > 0 ? tokens : [value];
}

function escapeLikePattern(value: string): string {
    return value.replace(/[\\%_]/g, "\\$&");
}

function isClosedDatabaseError(error: unknown): boolean {
    return error instanceof Error && /database connection is not open/i.test(error.message);
}

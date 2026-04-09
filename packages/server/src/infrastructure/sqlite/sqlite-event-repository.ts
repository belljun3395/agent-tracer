/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-event-repository
 *
 * IEventRepository SQLite 구현.
 */

import type Database from "better-sqlite3";
import type {
  EventClassification,
  MonitoringEventKind,
  MonitoringTask,
  TimelineEvent,
  TimelineLane
} from "@monitor/core";
import { EventId, normalizeLane, SessionId, TaskId } from "@monitor/core";

import type {
  EventInsertInput,
  IEventRepository,
  SearchBookmarkHit,
  SearchEventHit,
  SearchOptions,
  SearchResults,
  SearchTaskHit
} from "../../application/ports";
import type { IEmbeddingService } from "../embedding";
import {
  cosineSimilarity,
  deserializeEmbedding,
  EMBEDDING_MODEL,
  serializeEmbedding
} from "../embedding";
import { parseJsonField } from "./sqlite-json.js";
import {
  buildEventSearchText,
  type SearchDocumentScope,
  upsertSearchDocument
} from "./sqlite-search-documents.js";

const MIN_SEMANTIC_SCORE = 0.22;
const SEARCH_EMBEDDING_BACKFILL_THRESHOLD = 200;

interface EventRow {
  id: string;
  task_id: string;
  session_id: string | null;
  kind: MonitoringEventKind;
  lane: TimelineLane;
  title: string;
  body: string | null;
  metadata_json: string;
  classification_json: string;
  created_at: string;
}

interface SearchTaskRow {
  id: string;
  title: string;
  workspace_path: string | null;
  status: MonitoringTask["status"];
  updated_at: string;
}

interface SearchEventRow {
  event_id: string;
  task_id: string;
  task_title: string;
  title: string;
  body: string | null;
  lane: TimelineLane;
  kind: MonitoringEventKind;
  created_at: string;
}

interface SearchBookmarkRow {
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

interface SearchDocumentRow {
  scope: SearchDocumentScope;
  entity_id: string;
  task_id: string | null;
  search_text: string;
  embedding: string | null;
  updated_at: string;
}

interface RankedSearchDocument {
  readonly row: SearchDocumentRow;
  readonly lexicalScore: number;
  readonly semanticScore: number | null;
}

function mapEventRow(row: EventRow): TimelineEvent {
  return {
    id: EventId(row.id),
    taskId: TaskId(row.task_id),
    kind: row.kind,
    lane: normalizeLane(row.lane),
    title: row.title,
    metadata: parseJsonField<Record<string, unknown>>(row.metadata_json),
    classification: parseJsonField<EventClassification>(row.classification_json),
    createdAt: row.created_at,
    ...(row.session_id ? { sessionId: SessionId(row.session_id) } : {}),
    ...(row.body ? { body: row.body } : {})
  };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export class SqliteEventRepository implements IEventRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly embeddingService?: IEmbeddingService
  ) {}

  async insert(input: EventInsertInput): Promise<TimelineEvent> {
    this.db.prepare(`
      insert into timeline_events (id, task_id, session_id, kind, lane, title, body, metadata_json, classification_json, created_at)
      values (@id, @taskId, @sessionId, @kind, @lane, @title, @body, @metadataJson, @classificationJson, @createdAt)
    `).run({
      id: input.id,
      taskId: input.taskId,
      sessionId: input.sessionId ?? null,
      kind: input.kind,
      lane: input.lane,
      title: input.title,
      body: input.body ?? null,
      metadataJson: JSON.stringify(input.metadata),
      classificationJson: JSON.stringify(input.classification),
      createdAt: input.createdAt
    });
    this.refreshSearchDocument(input.id);
    return (await this.findById(input.id))!;
  }

  async findById(id: string): Promise<TimelineEvent | null> {
    const row = this.db
      .prepare<{ id: string }, EventRow>("select * from timeline_events where id = @id")
      .get({ id });
    return row ? mapEventRow(row) : null;
  }

  async findByTaskId(taskId: string): Promise<readonly TimelineEvent[]> {
    return this.db
      .prepare<{ taskId: string }, EventRow>(
        "select * from timeline_events where task_id = @taskId order by datetime(created_at) asc"
      )
      .all({ taskId })
      .map(mapEventRow);
  }

  async updateMetadata(eventId: string, metadata: Record<string, unknown>): Promise<TimelineEvent | null> {
    const existing = await this.findById(eventId);
    if (!existing) {
      return null;
    }

    this.db.prepare(`
      update timeline_events
      set metadata_json = @metadataJson
      where id = @id
    `).run({
      id: eventId,
      metadataJson: JSON.stringify(metadata)
    });

    this.refreshSearchDocument(eventId);
    return this.findById(eventId);
  }

  async countRawUserMessages(taskId: string): Promise<number> {
    const row = this.db
      .prepare<{ taskId: string }, { count: number }>(
        "select count(*) as count from timeline_events where task_id = @taskId and kind = 'user.message' and json_extract(metadata_json, '$.captureMode') = 'raw'"
      )
      .get({ taskId });
    return row?.count ?? 0;
  }

  async search(query: string, opts?: SearchOptions): Promise<SearchResults> {
    const safeLimit = Math.max(1, Math.min(50, opts?.limit ?? 8));
    const taskId = opts?.taskId ?? null;
    const taskDocuments = this.loadSearchDocuments("task");
    const eventDocuments = this.loadSearchDocuments("event", taskId);
    const bookmarkDocuments = this.loadSearchDocuments("bookmark", taskId);

    if (taskDocuments.length === 0 && eventDocuments.length === 0 && bookmarkDocuments.length === 0) {
      return this.legacySearch(query, opts);
    }

    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
      return { tasks: [], events: [], bookmarks: [] };
    }

    let queryVector: Float32Array | null = null;
    if (this.embeddingService) {
      try {
        await Promise.all([
          this.ensureSearchEmbeddings(taskDocuments),
          this.ensureSearchEmbeddings(eventDocuments),
          this.ensureSearchEmbeddings(bookmarkDocuments)
        ]);
        queryVector = await this.embeddingService.embed(query);
      } catch (error) {
        console.warn(
          "[monitor-server] semantic global search failed; falling back to lexical search:",
          error instanceof Error ? error.message : error
        );
      }
    }

    const rankedTasks = rankSearchDocuments(taskDocuments, normalizedQuery, queryVector, safeLimit);
    const rankedEvents = rankSearchDocuments(eventDocuments, normalizedQuery, queryVector, safeLimit);
    const rankedBookmarks = rankSearchDocuments(bookmarkDocuments, normalizedQuery, queryVector, safeLimit);

    return {
      tasks: this.hydrateTaskHits(rankedTasks.map((row) => row.entity_id)),
      events: this.hydrateEventHits(rankedEvents.map((row) => row.entity_id)),
      bookmarks: this.hydrateBookmarkHits(rankedBookmarks.map((row) => row.entity_id))
    };
  }

  private loadSearchDocuments(
    scope: SearchDocumentScope,
    taskId?: string | null
  ): readonly SearchDocumentRow[] {
    return this.db
      .prepare<{ scope: SearchDocumentScope; taskId: string | null }, SearchDocumentRow>(`
        select scope, entity_id, task_id, search_text, embedding, updated_at
        from search_documents
        where scope = @scope
          and (@taskId is null or scope = 'task' or task_id = @taskId)
      `)
      .all({ scope, taskId: taskId ?? null });
  }

  private async ensureSearchEmbeddings(rows: readonly SearchDocumentRow[]): Promise<void> {
    if (!this.embeddingService || rows.length === 0 || rows.length > SEARCH_EMBEDDING_BACKFILL_THRESHOLD) {
      return;
    }

    for (const row of rows) {
      if (row.embedding || !row.search_text.trim()) {
        continue;
      }

      try {
        const vector = await this.embeddingService.embed(row.search_text);
        const serialized = serializeEmbedding(vector);
        this.db.prepare(`
          update search_documents
          set embedding = @embedding,
              embedding_model = @embeddingModel
          where scope = @scope and entity_id = @entityId
        `).run({
          scope: row.scope,
          entityId: row.entity_id,
          embedding: serialized,
          embeddingModel: EMBEDDING_MODEL
        });
        (row as { embedding: string | null }).embedding = serialized;
      } catch (error) {
        if (isClosedDatabaseError(error)) {
          return;
        }
        console.warn(
          "[monitor-server] search document embedding failed:",
          error instanceof Error ? error.message : error
        );
        return;
      }
    }
  }

  private hydrateTaskHits(taskIds: readonly string[]): readonly SearchTaskHit[] {
    if (taskIds.length === 0) {
      return [];
    }

    const placeholders = taskIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare<readonly string[], SearchTaskRow>(`
        select id, title, workspace_path, status, updated_at
        from monitoring_tasks
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
        ...(row.workspace_path ? { workspacePath: row.workspace_path } : {})
      }];
    });
  }

  private hydrateEventHits(eventIds: readonly string[]): readonly SearchEventHit[] {
    if (eventIds.length === 0) {
      return [];
    }

    const placeholders = eventIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare<readonly string[], SearchEventRow>(`
        select e.id as event_id, e.task_id, t.title as task_title, e.title, e.body, e.lane, e.kind, e.created_at
        from timeline_events e
        join monitoring_tasks t on t.id = e.task_id
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
        ...(row.body ? { snippet: row.body } : {})
      }];
    });
  }

  private hydrateBookmarkHits(bookmarkIds: readonly string[]): readonly SearchBookmarkHit[] {
    if (bookmarkIds.length === 0) {
      return [];
    }

    const placeholders = bookmarkIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare<readonly string[], SearchBookmarkRow>(`
        select b.id, b.task_id, b.event_id, b.kind, b.title, b.note, b.created_at, t.title as task_title, e.title as event_title
        from bookmarks b
        join monitoring_tasks t on t.id = b.task_id
        left join timeline_events e on e.id = b.event_id
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
        ...(row.event_title ? { eventTitle: row.event_title } : {})
      }];
    });
  }

  private refreshSearchDocument(eventId: string): void {
    const row = this.db
      .prepare<{ eventId: string }, SearchEventRow & { metadata_json: string }>(`
        select
          e.id as event_id,
          e.task_id,
          t.title as task_title,
          e.title,
          e.body,
          e.lane,
          e.kind,
          e.metadata_json,
          e.created_at
        from timeline_events e
        join monitoring_tasks t on t.id = e.task_id
        where e.id = @eventId
      `)
      .get({ eventId });
    if (!row) {
      return;
    }

    upsertSearchDocument(this.db, {
      scope: "event",
      entityId: row.event_id,
      taskId: row.task_id,
      searchText: buildEventSearchText({
        taskTitle: row.task_title,
        title: row.title,
        body: row.body,
        kind: row.kind,
        lane: row.lane,
        metadata: parseJsonField<Record<string, unknown>>(row.metadata_json)
      }),
      updatedAt: row.created_at
    });
  }

  private legacySearch(query: string, opts?: SearchOptions): SearchResults {
    const pattern = `%${escapeLikePattern(query.trim().toLowerCase())}%`;
    const safeLimit = Math.max(1, Math.min(50, opts?.limit ?? 8));
    const taskId = opts?.taskId ?? null;

    const tasks = this.db
      .prepare<{ pattern: string; limit: number }, SearchTaskRow>(`
        select id, title, workspace_path, status, updated_at
        from monitoring_tasks
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
        ...(row.workspace_path ? { workspacePath: row.workspace_path } : {})
      }));

    const events = this.db
      .prepare<{ pattern: string; limit: number; taskId: string | null }, SearchEventRow>(`
        select e.id as event_id, e.task_id, t.title as task_title, e.title, e.body, e.lane, e.kind, e.created_at
        from timeline_events e
        join monitoring_tasks t on t.id = e.task_id
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
        ...(row.body ? { snippet: row.body } : {})
      }));

    const bookmarks = this.db
      .prepare<{ pattern: string; limit: number; taskId: string | null }, SearchBookmarkRow>(`
        select b.id, b.task_id, b.event_id, b.kind, b.title, b.note, b.created_at, t.title as task_title, e.title as event_title
        from bookmarks b
        join monitoring_tasks t on t.id = b.task_id
        left join timeline_events e on e.id = b.event_id
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
        ...(row.event_title ? { eventTitle: row.event_title } : {})
      }));

    return { tasks, events, bookmarks };
  }
}

function rankSearchDocuments(
  rows: readonly SearchDocumentRow[],
  normalizedQuery: string,
  queryVector: Float32Array | null,
  limit: number
): readonly SearchDocumentRow[] {
  const lexicalMatches = scoreLexicalMatches(rows, normalizedQuery);
  const semanticMatches = queryVector
    ? scoreSemanticMatches(rows, queryVector)
    : [];
  const ranked = new Map<string, RankedSearchDocument>();

  for (const semantic of semanticMatches) {
    ranked.set(semantic.row.entity_id, {
      row: semantic.row,
      lexicalScore: 0,
      semanticScore: semantic.score
    });
  }

  for (const lexical of lexicalMatches) {
    const existing = ranked.get(lexical.row.entity_id);
    if (existing) {
      ranked.set(lexical.row.entity_id, {
        ...existing,
        lexicalScore: Math.max(existing.lexicalScore, lexical.score)
      });
      continue;
    }

    ranked.set(lexical.row.entity_id, {
      row: lexical.row,
      lexicalScore: lexical.score,
      semanticScore: null
    });
  }

  return [...ranked.values()]
    .sort((left, right) =>
      combinedRankScore(right) - combinedRankScore(left)
      || compareSearchDocumentRows(right.row, left.row)
    )
    .slice(0, limit)
    .map((entry) => entry.row);
}

function scoreLexicalMatches(
  rows: readonly SearchDocumentRow[],
  normalizedQuery: string
): readonly { row: SearchDocumentRow; score: number }[] {
  const queryTokens = tokenizeText(normalizedQuery);

  return rows
    .map((row) => ({
      row,
      score: computeLexicalScore(row.search_text, normalizedQuery, queryTokens)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score
      || compareSearchDocumentRows(right.row, left.row)
    );
}

function scoreSemanticMatches(
  rows: readonly SearchDocumentRow[],
  queryVector: Float32Array
): readonly { row: SearchDocumentRow; score: number }[] {
  return rows
    .filter((row) => row.embedding)
    .map((row) => ({
      row,
      score: cosineSimilarity(queryVector, deserializeEmbedding(row.embedding as string))
    }))
    .filter((entry) => entry.score >= MIN_SEMANTIC_SCORE)
    .sort((left, right) =>
      right.score - left.score
      || compareSearchDocumentRows(right.row, left.row)
    );
}

function computeLexicalScore(
  value: string,
  normalizedQuery: string,
  queryTokens: readonly string[]
): number {
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

function normalizeSearchText(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return normalized || null;
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

function isClosedDatabaseError(error: unknown): boolean {
  return error instanceof Error && /database connection is not open/i.test(error.message);
}

/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-evaluation-repository
 *
 * IEvaluationRepository SQLite 구현.
 * IEmbeddingService가 주입되면 시맨틱 검색을 사용하고,
 * 없으면 LIKE 패턴 검색으로 폴백한다.
 */

import type Database from "better-sqlite3";

import type { IEvaluationRepository, TaskEvaluation, WorkflowSearchResult, WorkflowSummary } from "../../application/ports/evaluation-repository.js";
import type { TimelineEvent } from "@monitor/core";
import { parseJsonField } from "./sqlite-json.js";
import { buildWorkflowContext } from "../../application/workflow-context-builder.helpers.js";
import type { IEmbeddingService } from "../embedding/index.js";
import { cosineSimilarity, serializeEmbedding, deserializeEmbedding, EMBEDDING_MODEL } from "../embedding/index.js";

interface EvaluationRow {
  task_id: string;
  rating: string;
  use_case: string | null;
  workflow_tags: string | null;
  outcome_note: string | null;
  evaluated_at: string;
}

interface TaskWithEvaluationRow {
  task_id: string;
  title: string;
  use_case: string | null;
  workflow_tags: string | null;
  outcome_note: string | null;
  rating: string;
  event_count: number;
  created_at: string;
}

interface EvaluationRowWithEmbedding extends TaskWithEvaluationRow {
  embedding: string | null;
}

interface EventRow {
  id: string;
  task_id: string;
  session_id: string | null;
  kind: string;
  lane: string;
  title: string;
  body: string | null;
  metadata_json: string;
  classification_json: string;
  created_at: string;
}

function mapEvaluationRow(row: EvaluationRow): TaskEvaluation {
  return {
    taskId: row.task_id,
    rating: row.rating as "good" | "skip",
    useCase: row.use_case,
    workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
    outcomeNote: row.outcome_note,
    evaluatedAt: row.evaluated_at
  };
}

function mapEventRow(row: EventRow): TimelineEvent {
  return {
    id: row.id,
    taskId: row.task_id,
    ...(row.session_id ? { sessionId: row.session_id } : {}),
    kind: row.kind as TimelineEvent["kind"],
    lane: row.lane as TimelineEvent["lane"],
    title: row.title,
    ...(row.body ? { body: row.body } : {}),
    metadata: parseJsonField(row.metadata_json),
    classification: parseJsonField(row.classification_json),
    createdAt: row.created_at
  };
}

export class SqliteEvaluationRepository implements IEvaluationRepository {
  constructor(
    private readonly db: Database.Database,
    private readonly embeddingService?: IEmbeddingService
  ) {}

  async upsertEvaluation(evaluation: TaskEvaluation): Promise<void> {
    this.db.prepare(`
      insert into task_evaluations (task_id, rating, use_case, workflow_tags, outcome_note, evaluated_at)
      values (@taskId, @rating, @useCase, @workflowTags, @outcomeNote, @evaluatedAt)
      on conflict(task_id) do update set
        rating        = excluded.rating,
        use_case      = excluded.use_case,
        workflow_tags = excluded.workflow_tags,
        outcome_note  = excluded.outcome_note,
        evaluated_at  = excluded.evaluated_at
    `).run({
      taskId: evaluation.taskId,
      rating: evaluation.rating,
      useCase: evaluation.useCase ?? null,
      workflowTags: evaluation.workflowTags.length > 0 ? JSON.stringify(evaluation.workflowTags) : null,
      outcomeNote: evaluation.outcomeNote ?? null,
      evaluatedAt: evaluation.evaluatedAt
    });

    // 임베딩은 비동기로 fire-and-forget (응답 지연 방지)
    if (this.embeddingService) {
      void this.generateAndSaveEmbedding(evaluation);
    }
  }

  private async generateAndSaveEmbedding(evaluation: TaskEvaluation): Promise<void> {
    try {
      const eventRows = this.db
        .prepare<{ taskId: string }, EventRow>(
          "select * from timeline_events where task_id = @taskId order by created_at asc"
        )
        .all({ taskId: evaluation.taskId });
      const events = eventRows.map(mapEventRow);

      const title = this.db
        .prepare<{ taskId: string }, { title: string }>("select title from monitoring_tasks where id = @taskId")
        .get({ taskId: evaluation.taskId })?.title ?? "";

      const text = buildEmbeddingText(evaluation, events, title);
      const vector = await this.embeddingService!.embed(text, "document");

      this.db.prepare(`
        update task_evaluations set embedding = @embedding, embedding_model = @model
        where task_id = @taskId
      `).run({
        embedding: serializeEmbedding(vector),
        model: EMBEDDING_MODEL,
        taskId: evaluation.taskId,
      });
    } catch (err) {
      console.warn("[monitor-server] embedding generation failed:", err instanceof Error ? err.message : err);
    }
  }

  async listEvaluations(rating?: "good" | "skip"): Promise<readonly WorkflowSummary[]> {
    const whereClause = rating ? "where e.rating = @rating" : "";
    const rows = this.db.prepare<{ rating?: string }, TaskWithEvaluationRow & { evaluated_at: string }>(`
      select
        e.task_id,
        t.title,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.rating,
        e.evaluated_at,
        count(ev.id) as event_count,
        t.created_at
      from task_evaluations e
      join monitoring_tasks t on t.id = e.task_id
      left join timeline_events ev on ev.task_id = e.task_id
      ${whereClause}
      group by e.task_id
      order by (e.rating = 'good') desc, datetime(e.evaluated_at) desc
    `).all(rating ? { rating } : {} as { rating?: string });

    return rows.map((row) => ({
      taskId: row.task_id,
      title: row.title,
      useCase: row.use_case,
      workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
      outcomeNote: row.outcome_note,
      rating: row.rating as "good" | "skip",
      eventCount: row.event_count,
      createdAt: row.created_at,
      evaluatedAt: (row as { evaluated_at: string }).evaluated_at
    }));
  }

  async getEvaluation(taskId: string): Promise<TaskEvaluation | null> {
    const row = this.db
      .prepare<{ taskId: string }, EvaluationRow>(
        "select * from task_evaluations where task_id = @taskId"
      )
      .get({ taskId });
    return row ? mapEvaluationRow(row) : null;
  }

  async searchSimilarWorkflows(
    query: string,
    tags?: readonly string[],
    limit = 5
  ): Promise<readonly WorkflowSearchResult[]> {
    const effectiveLimit = Math.min(limit, 10);

    if (this.embeddingService && query.trim().length > 0) {
      const results = await this.semanticSearch(query, tags, effectiveLimit);
      if (results.length > 0) return results;
      // 임베딩이 아직 없는 경우(신규 DB) LIKE로 폴백
    }

    return this.likeSearch(query, tags, effectiveLimit);
  }

  private async semanticSearch(
    query: string,
    tags: readonly string[] | undefined,
    limit: number
  ): Promise<readonly WorkflowSearchResult[]> {
    const rows = this.db.prepare<Record<string, never>, EvaluationRowWithEmbedding>(`
      select
        e.task_id,
        t.title,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.rating,
        e.embedding,
        count(ev.id) as event_count,
        t.created_at
      from task_evaluations e
      join monitoring_tasks t on t.id = e.task_id
      left join timeline_events ev on ev.task_id = e.task_id
      where e.embedding is not null
      group by e.task_id
    `).all({});

    if (rows.length === 0) return [];

    const queryVector = await this.embeddingService!.embed(query, "query");

    const scored = rows
      .map((row) => ({
        row,
        score: cosineSimilarity(queryVector, deserializeEmbedding(row.embedding!)),
      }))
      .sort((a, b) => b.score - a.score);

    const filtered = applyTagFilter(scored.map((s) => s.row), tags).slice(0, limit);

    return filtered.map((row) => {
      const eventRows = this.db
        .prepare<{ taskId: string }, EventRow>(
          "select * from timeline_events where task_id = @taskId order by created_at asc"
        )
        .all({ taskId: row.task_id });
      return {
        taskId: row.task_id,
        title: row.title,
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        rating: row.rating,
        eventCount: row.event_count,
        createdAt: row.created_at,
        workflowContext: buildWorkflowContext(eventRows.map(mapEventRow), row.title),
      };
    });
  }

  private likeSearch(
    query: string,
    tags: readonly string[] | undefined,
    limit: number
  ): readonly WorkflowSearchResult[] {
    const pattern = `%${query.toLowerCase().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const rows = this.db.prepare<{ pattern: string }, TaskWithEvaluationRow>(`
      select
        e.task_id,
        t.title,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.rating,
        count(ev.id) as event_count,
        t.created_at
      from task_evaluations e
      join monitoring_tasks t on t.id = e.task_id
      left join timeline_events ev on ev.task_id = e.task_id
      where (
        lower(t.title) like @pattern escape '\\'
        or lower(coalesce(e.use_case, '')) like @pattern escape '\\'
        or lower(coalesce(e.workflow_tags, '')) like @pattern escape '\\'
        or lower(coalesce(e.outcome_note, '')) like @pattern escape '\\'
      )
      group by e.task_id
      order by (e.rating = 'good') desc, datetime(e.evaluated_at) desc
      limit ${limit}
    `).all({ pattern });

    const filtered = applyTagFilter(rows, tags);

    return filtered.map(row => {
      const eventRows = this.db
        .prepare<{ taskId: string }, EventRow>(
          "select * from timeline_events where task_id = @taskId order by created_at asc"
        )
        .all({ taskId: row.task_id });
      return {
        taskId: row.task_id,
        title: row.title,
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        rating: row.rating,
        eventCount: row.event_count,
        createdAt: row.created_at,
        workflowContext: buildWorkflowContext(eventRows.map(mapEventRow), row.title),
      };
    });
  }
}

function applyTagFilter<T extends { workflow_tags: string | null }>(
  rows: readonly T[],
  tags: readonly string[] | undefined
): readonly T[] {
  if (!tags || tags.length === 0) return rows;
  return rows.filter((row) => {
    if (!row.workflow_tags) return false;
    const rowTags = parseJsonField<string[]>(row.workflow_tags);
    return tags.some(t => rowTags.some(rt => rt.toLowerCase().includes(t.toLowerCase())));
  });
}

function buildEmbeddingText(
  evaluation: TaskEvaluation,
  events: readonly TimelineEvent[],
  title: string
): string {
  const parts = [
    title,
    evaluation.useCase ?? "",
    evaluation.workflowTags.join(" "),
    evaluation.outcomeNote ?? "",
    buildWorkflowContext(events, title),
  ];
  return parts.filter(Boolean).join("\n").slice(0, 4000); // Voyage 토큰 제한 고려
}

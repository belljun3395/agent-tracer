/* eslint-disable @typescript-eslint/require-await */
/**
 * @module infrastructure/sqlite/sqlite-evaluation-repository
 *
 * IEvaluationRepository SQLite 구현.
 */

import type Database from "better-sqlite3";

import type { IEvaluationRepository, PersistedTaskEvaluation, TaskEvaluation, WorkflowSearchResult, WorkflowSummary } from "../../application/ports/evaluation-repository.js";
import type { TimelineEvent } from "@monitor/core";
import { parseJsonField } from "./sqlite-json.js";
import { buildWorkflowContext } from "../../application/workflow-context-builder.helpers.js";

interface EvaluationRow {
  task_id: string;
  rating: string;
  use_case: string | null;
  workflow_tags: string | null;
  outcome_note: string | null;
  approach_note: string | null;
  reuse_when: string | null;
  watchouts: string | null;
  search_text: string | null;
  evaluated_at: string;
}

interface TaskWithEvaluationRow {
  task_id: string;
  title: string;
  use_case: string | null;
  workflow_tags: string | null;
  outcome_note: string | null;
  approach_note: string | null;
  reuse_when: string | null;
  watchouts: string | null;
  search_text: string | null;
  rating: string;
  event_count: number;
  created_at: string;
  evaluated_at?: string;
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
    approachNote: row.approach_note,
    reuseWhen: row.reuse_when,
    watchouts: row.watchouts,
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
  constructor(private readonly db: Database.Database) {}

  async upsertEvaluation(evaluation: PersistedTaskEvaluation): Promise<void> {
    this.db.prepare(`
      insert into task_evaluations (
        task_id, rating, use_case, workflow_tags, outcome_note, approach_note, reuse_when, watchouts, search_text, evaluated_at
      )
      values (
        @taskId, @rating, @useCase, @workflowTags, @outcomeNote, @approachNote, @reuseWhen, @watchouts, @searchText, @evaluatedAt
      )
      on conflict(task_id) do update set
        rating        = excluded.rating,
        use_case      = excluded.use_case,
        workflow_tags = excluded.workflow_tags,
        outcome_note  = excluded.outcome_note,
        approach_note = excluded.approach_note,
        reuse_when    = excluded.reuse_when,
        watchouts     = excluded.watchouts,
        search_text   = excluded.search_text,
        evaluated_at  = excluded.evaluated_at
    `).run({
      taskId: evaluation.taskId,
      rating: evaluation.rating,
      useCase: evaluation.useCase ?? null,
      workflowTags: evaluation.workflowTags.length > 0 ? JSON.stringify(evaluation.workflowTags) : null,
      outcomeNote: evaluation.outcomeNote ?? null,
      approachNote: evaluation.approachNote ?? null,
      reuseWhen: evaluation.reuseWhen ?? null,
      watchouts: evaluation.watchouts ?? null,
      searchText: evaluation.searchText ?? null,
      evaluatedAt: evaluation.evaluatedAt
    });
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
        e.approach_note,
        e.reuse_when,
        e.watchouts,
        e.search_text,
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
      approachNote: row.approach_note,
      reuseWhen: row.reuse_when,
      watchouts: row.watchouts,
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
    const pattern = `%${query.toLowerCase().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;

    const rows = this.db.prepare<{ pattern: string }, TaskWithEvaluationRow>(`
      select
        e.task_id,
        t.title,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.approach_note,
        e.reuse_when,
        e.watchouts,
        e.search_text,
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
        or lower(coalesce(e.approach_note, '')) like @pattern escape '\\'
        or lower(coalesce(e.reuse_when, '')) like @pattern escape '\\'
        or lower(coalesce(e.watchouts, '')) like @pattern escape '\\'
        or lower(coalesce(e.search_text, '')) like @pattern escape '\\'
      )
      group by e.task_id
      order by (e.rating = 'good') desc, datetime(e.evaluated_at) desc
      limit ${effectiveLimit}
    `).all({ pattern });

    // tags 필터 (post-filter)
    const filtered = tags && tags.length > 0
      ? rows.filter((row) => {
          if (!row.workflow_tags) return false;
          const rowTags = parseJsonField<string[]>(row.workflow_tags);
          return tags.some(t => rowTags.some(rt => rt.toLowerCase().includes(t.toLowerCase())));
        })
      : rows;

    return filtered.map(row => {
      // 각 태스크의 이벤트 로드 후 워크플로우 컨텍스트 빌드
      const eventRows = this.db
        .prepare<{ taskId: string }, EventRow>(
          "select * from timeline_events where task_id = @taskId order by created_at asc"
        )
        .all({ taskId: row.task_id });
      const events = eventRows.map(mapEventRow);
      return {
        taskId: row.task_id,
        title: row.title,
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        approachNote: row.approach_note,
        reuseWhen: row.reuse_when,
        watchouts: row.watchouts,
        rating: row.rating as "good" | "skip",
        eventCount: row.event_count,
        createdAt: row.created_at,
        workflowContext: buildWorkflowContext(events, row.title, {
          useCase: row.use_case,
          workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
          outcomeNote: row.outcome_note,
          approachNote: row.approach_note,
          reuseWhen: row.reuse_when,
          watchouts: row.watchouts
        })
      };
    });
  }
}

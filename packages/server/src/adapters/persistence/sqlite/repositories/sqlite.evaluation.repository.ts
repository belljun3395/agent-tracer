import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type {
    BriefingSaveInput,
    IEvaluationRepository,
    PersistedTaskEvaluation,
    StoredTaskEvaluation,
    WorkflowContentRecord,
    WorkflowSearchResult,
    WorkflowSummary,
} from "~application/ports/repository/evaluation.repository.js";
import type { IEmbeddingService } from "~application/ports/service/embedding.service.js";
import type { TimelineEvent } from "~domain/monitoring/timeline.event.model.js";
import type { ReusableTaskSnapshot } from "~domain/workflow/task.snapshot.js";
import { buildReusableTaskSnapshot } from "~domain/workflow/task.snapshot.js";
import type { SavedBriefing } from "~domain/workflow/briefing.js";
import { buildWorkflowContext } from "~domain/workflow/workflow.context.js";
import { cosineSimilarity, deserializeEmbedding, serializeEmbedding } from "../shared/embedding.codec.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "../shared/drizzle.db.js";
import { parseJsonField } from "../shared/sqlite.json";
import type { BriefingRow, EvaluationRow, EventRow, TaskWithEvaluationRow } from "./sqlite.evaluation.row.type.js";
import { buildEvaluationData, buildQualitySignals, mapBriefingRow, mapEvaluationRow, mapEventRow } from "./sqlite.evaluation.row.type.js";
import {
    MIN_SEMANTIC_SCORE,
    applyTagFilter,
    buildEmbeddingText,
    buildSnapshotId,
    compareWorkflowSummaryRows,
    filterWorkflowEventsForScopeKey,
    isClosedDatabaseError,
    mapWorkflowSummary,
    mergeRankedRows,
    resolveWorkflowDisplayTitle,
    scoreLexicalMatches,
    shouldResolveDisplayTitle,
} from "../search/sqlite.evaluation.search.js";

export class SqliteEvaluationRepository implements IEvaluationRepository {
    private readonly db: Database.Database;

    constructor(db: SqliteDatabaseInput, private readonly embeddingService?: IEmbeddingService) {
        this.db = ensureSqliteDatabase(db).client;
    }

    async upsertEvaluation(evaluation: PersistedTaskEvaluation): Promise<void> {
        this.db.prepare(`
      insert into task_evaluations (
        task_id, scope_key, scope_kind, scope_label, turn_index, rating, use_case, workflow_tags, outcome_note, approach_note, reuse_when, watchouts,
        workflow_snapshot_json, workflow_context, search_text, evaluated_at
      )
      values (
        @taskId, @scopeKey, @scopeKind, @scopeLabel, @turnIndex, @rating, @useCase, @workflowTags, @outcomeNote, @approachNote, @reuseWhen, @watchouts,
        @workflowSnapshotJson, @workflowContext, @searchText, @evaluatedAt
      )
      on conflict(task_id, scope_key) do update set
        scope_kind      = excluded.scope_kind,
        scope_label     = excluded.scope_label,
        turn_index      = excluded.turn_index,
        rating          = excluded.rating,
        use_case        = excluded.use_case,
        workflow_tags   = excluded.workflow_tags,
        outcome_note    = excluded.outcome_note,
        approach_note   = excluded.approach_note,
        reuse_when      = excluded.reuse_when,
        watchouts       = excluded.watchouts,
        workflow_snapshot_json = excluded.workflow_snapshot_json,
        workflow_context = excluded.workflow_context,
        search_text     = excluded.search_text,
        evaluated_at    = excluded.evaluated_at,
        version         = task_evaluations.version + 1
    `).run({
            taskId: evaluation.taskId,
            scopeKey: evaluation.scopeKey,
            scopeKind: evaluation.scopeKind,
            scopeLabel: evaluation.scopeLabel,
            turnIndex: evaluation.turnIndex,
            rating: evaluation.rating,
            useCase: evaluation.useCase ?? null,
            workflowTags: evaluation.workflowTags.length > 0 ? JSON.stringify(evaluation.workflowTags) : null,
            outcomeNote: evaluation.outcomeNote ?? null,
            approachNote: evaluation.approachNote ?? null,
            reuseWhen: evaluation.reuseWhen ?? null,
            watchouts: evaluation.watchouts ?? null,
            workflowSnapshotJson: evaluation.workflowSnapshot ? JSON.stringify(evaluation.workflowSnapshot) : null,
            workflowContext: evaluation.workflowContext ?? null,
            searchText: evaluation.searchText ?? null,
            evaluatedAt: evaluation.evaluatedAt,
        });
        if (this.embeddingService) {
            void this.generateAndSaveEmbedding(evaluation);
        }
    }

    async recordBriefingCopy(taskId: string, copiedAt: string, scopeKey = "task"): Promise<void> {
        const result = this.db.prepare(`
          update task_evaluations
          set briefing_copy_count = coalesce(briefing_copy_count, 0) + 1,
              last_reused_at = @copiedAt
          where task_id = @taskId
            and scope_key = @scopeKey
        `).run({ taskId, copiedAt, scopeKey });
        if (result.changes === 0) {
            throw new Error(`No evaluation record found for task ${taskId} and scope ${scopeKey}`);
        }
    }

    async saveBriefing(taskId: string, briefing: BriefingSaveInput): Promise<SavedBriefing> {
        const id = `briefing-${randomUUID()}`;
        this.db.prepare(`
          insert into briefings (
            id, task_id, generated_at, purpose, format, memo, content
          ) values (
            @id, @taskId, @generatedAt, @purpose, @format, @memo, @content
          )
        `).run({
            id,
            taskId,
            generatedAt: briefing.generatedAt,
            purpose: briefing.purpose,
            format: briefing.format,
            memo: briefing.memo ?? null,
            content: briefing.content,
        });
        return {
            id,
            taskId,
            generatedAt: briefing.generatedAt,
            purpose: briefing.purpose,
            format: briefing.format,
            memo: briefing.memo ?? null,
            content: briefing.content,
        };
    }

    async listBriefings(taskId: string): Promise<readonly SavedBriefing[]> {
        const rows = this.db.prepare<{ taskId: string }, BriefingRow>(`
          select * from briefings
          where task_id = @taskId
          order by generated_at desc
        `).all({ taskId });
        return rows.map(mapBriefingRow);
    }

    async listEvaluations(rating?: "good" | "skip"): Promise<readonly WorkflowSummary[]> {
        const rows = this.loadSearchRows(undefined, rating);
        return [...rows].sort(compareWorkflowSummaryRows).map((row) => this.hydrateWorkflowSummary(row));
    }

    async getEvaluation(taskId: string, scopeKey = "task"): Promise<StoredTaskEvaluation | null> {
        const row = this.db
            .prepare<{ taskId: string; scopeKey: string }, EvaluationRow>(
                "select * from task_evaluations where task_id = @taskId and scope_key = @scopeKey",
            )
            .get({ taskId, scopeKey });
        return row ? mapEvaluationRow(row) : null;
    }

    async getWorkflowContent(taskId: string, scopeKey = "task"): Promise<WorkflowContentRecord | null> {
        const row = this.db.prepare<{ taskId: string; scopeKey: string }, TaskWithEvaluationRow>(`
      select
        e.task_id, e.scope_key, e.scope_kind, e.scope_label, e.turn_index,
        t.title, t.slug, t.workspace_path,
        e.use_case, e.workflow_tags, e.outcome_note, e.approach_note, e.reuse_when, e.watchouts,
        e.version, e.promoted_to, e.reuse_count, e.last_reused_at, e.briefing_copy_count,
        e.workflow_snapshot_json, e.workflow_context, e.search_text,
        e.embedding, e.embedding_model, e.rating, e.evaluated_at,
        count(ev.id) as event_count, t.created_at
      from task_evaluations e
      join monitoring_tasks t on t.id = e.task_id
      left join timeline_events ev on ev.task_id = e.task_id
      where e.task_id = @taskId and e.scope_key = @scopeKey
      group by e.task_id, e.scope_key
    `).get({ taskId, scopeKey });
        if (!row) return null;
        return this.hydrateWorkflowContent(row);
    }

    async searchWorkflowLibrary(query: string, rating?: "good" | "skip", limit = 50): Promise<readonly WorkflowSummary[]> {
        const effectiveLimit = Math.min(Math.max(limit, 1), 100);
        const rankedRows = await this.rankWorkflowRows(query, undefined, effectiveLimit, rating);
        return rankedRows.map((row) => this.hydrateWorkflowSummary(row));
    }

    async searchSimilarWorkflows(query: string, tags?: readonly string[], limit = 5): Promise<readonly WorkflowSearchResult[]> {
        const effectiveLimit = Math.min(limit, 10);
        const rankedRows = await this.rankWorkflowRows(query, tags, effectiveLimit);
        return rankedRows.map((row) => this.hydrateSearchResult(row));
    }

    private async generateAndSaveEmbedding(evaluation: PersistedTaskEvaluation): Promise<void> {
        try {
            const titleRow = this.db
                .prepare<{ taskId: string }, { title: string }>("select title from monitoring_tasks where id = @taskId")
                .get({ taskId: evaluation.taskId });
            const events = this.loadWorkflowEvents(evaluation.taskId);
            const embeddingText = buildEmbeddingText(evaluation, events, titleRow?.title ?? "");
            const vector = await this.embeddingService!.embed(embeddingText);
            this.db.prepare(`
        update task_evaluations
        set embedding = @embedding,
            embedding_model = @embeddingModel
        where task_id = @taskId
      `).run({
                taskId: evaluation.taskId,
                embedding: serializeEmbedding(vector),
                embeddingModel: this.embeddingService!.modelId,
            });
        } catch (error) {
            if (isClosedDatabaseError(error)) return;
            console.warn("[monitor-server] embedding generation failed:", error instanceof Error ? error.message : error);
        }
    }

    private loadSearchRows(tags?: readonly string[], rating?: "good" | "skip"): readonly TaskWithEvaluationRow[] {
        const whereConditions = [rating ? "e.rating = @rating" : null].filter((c): c is string => Boolean(c));
        const whereClause = whereConditions.length > 0 ? `where ${whereConditions.join(" and ")}` : "";
        const rows = this.db.prepare<{ rating?: "good" | "skip" }, TaskWithEvaluationRow>(`
      select
        e.task_id, e.scope_key, e.scope_kind, e.scope_label, e.turn_index,
        t.title, t.slug, t.workspace_path,
        e.use_case, e.workflow_tags, e.outcome_note, e.approach_note, e.reuse_when, e.watchouts,
        e.version, e.promoted_to, e.reuse_count, e.last_reused_at, e.briefing_copy_count,
        e.workflow_snapshot_json, e.workflow_context, e.search_text,
        e.embedding, e.embedding_model, e.rating, e.evaluated_at,
        count(ev.id) as event_count, t.created_at
      from task_evaluations e
      join monitoring_tasks t on t.id = e.task_id
      left join timeline_events ev on ev.task_id = e.task_id
      ${whereClause}
      group by e.task_id, e.scope_key
    `).all(rating ? { rating } : {});
        return applyTagFilter(rows, tags);
    }

    private async rankWorkflowRows(
        query: string,
        tags: readonly string[] | undefined,
        limit: number,
        rating?: "good" | "skip",
    ): Promise<readonly TaskWithEvaluationRow[]> {
        const rows = this.loadSearchRows(tags, rating);
        if (rows.length === 0) return [];
        const lexicalMatches = scoreLexicalMatches(rows, query);
        let semanticMatches: readonly { row: TaskWithEvaluationRow; score: number }[] = [];
        if (this.embeddingService && query.trim().length > 0) {
            try {
                semanticMatches = await this.scoreSemanticMatches(rows, query);
            } catch (error) {
                console.warn(
                    "[monitor-server] semantic workflow search failed; falling back to lexical search:",
                    error instanceof Error ? error.message : error,
                );
            }
        }
        return mergeRankedRows(semanticMatches, lexicalMatches, limit);
    }

    private async scoreSemanticMatches(
        rows: readonly TaskWithEvaluationRow[],
        query: string,
    ): Promise<readonly { row: TaskWithEvaluationRow; score: number }[]> {
        const embeddedRows = rows.filter((row) => typeof row.embedding === "string" && row.embedding.length > 0);
        if (embeddedRows.length === 0) return [];
        const queryVector = await this.embeddingService!.embed(query);
        return embeddedRows
            .map((row) => ({ row, score: cosineSimilarity(queryVector, deserializeEmbedding(row.embedding as string)) }))
            .filter((entry) => entry.score >= MIN_SEMANTIC_SCORE)
            .sort((left, right) => right.score - left.score);
    }

    private hydrateSearchResult(row: TaskWithEvaluationRow): WorkflowSearchResult {
        const content = this.buildWorkflowContent(row);
        const eventCount = this.loadWorkflowEvents(row.task_id, row.scope_key).length;
        return {
            layer: "snapshot",
            snapshotId: buildSnapshotId(row.task_id, row.scope_key),
            taskId: row.task_id,
            scopeKey: row.scope_key,
            scopeKind: row.scope_kind as "task" | "turn",
            scopeLabel: row.scope_label,
            turnIndex: row.turn_index,
            title: row.title,
            ...(content.displayTitle ? { displayTitle: content.displayTitle } : {}),
            useCase: row.use_case,
            workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
            outcomeNote: row.outcome_note,
            approachNote: row.approach_note,
            reuseWhen: row.reuse_when,
            watchouts: row.watchouts,
            rating: row.rating as "good" | "skip",
            eventCount,
            createdAt: row.created_at,
            workflowContext: content.workflowContext,
            version: row.version,
            promotedTo: row.promoted_to,
            qualitySignals: buildQualitySignals(row),
        };
    }

    private hydrateWorkflowSummary(row: TaskWithEvaluationRow): WorkflowSummary {
        const eventCount = this.loadWorkflowEvents(row.task_id, row.scope_key).length;
        const displayTitle = shouldResolveDisplayTitle(row)
            ? resolveWorkflowDisplayTitle(row, this.loadWorkflowEvents(row.task_id, row.scope_key))
            : undefined;
        return mapWorkflowSummary(row, eventCount, displayTitle);
    }

    private hydrateWorkflowContent(row: TaskWithEvaluationRow): WorkflowContentRecord {
        return this.buildWorkflowContent(row);
    }

    private loadWorkflowEvents(taskId: string, scopeKey = "task"): readonly TimelineEvent[] {
        const eventRows = this.db
            .prepare<{ taskId: string }, EventRow>(
                "select * from timeline_events where task_id = @taskId order by created_at asc",
            )
            .all({ taskId });
        return filterWorkflowEventsForScopeKey(eventRows.map(mapEventRow), scopeKey);
    }

    private buildWorkflowContent(row: TaskWithEvaluationRow): WorkflowContentRecord {
        const events = this.loadWorkflowEvents(row.task_id, row.scope_key);
        const evaluation = buildEvaluationData(row);
        const displayTitle = resolveWorkflowDisplayTitle(row, events);
        const title = displayTitle ?? row.title;
        const generatedSnapshot = buildReusableTaskSnapshot({ objective: title, events, evaluation });
        const storedSnapshot = row.workflow_snapshot_json
            ? parseJsonField<ReusableTaskSnapshot>(row.workflow_snapshot_json)
            : null;
        const workflowSnapshot = storedSnapshot ?? generatedSnapshot;
        const generatedContext = buildWorkflowContext(events, title, evaluation, workflowSnapshot);
        const workflowContext = row.workflow_context ?? generatedContext;
        const source = row.workflow_snapshot_json || row.workflow_context ? "saved" : "generated";
        return {
            snapshotId: buildSnapshotId(row.task_id, row.scope_key),
            taskId: row.task_id,
            scopeKey: row.scope_key,
            scopeKind: row.scope_kind as "task" | "turn",
            scopeLabel: row.scope_label,
            turnIndex: row.turn_index,
            title: row.title,
            ...(displayTitle ? { displayTitle } : {}),
            workflowSnapshot,
            workflowContext,
            searchText: row.search_text ?? workflowSnapshot.searchText,
            source,
            version: row.version,
            promotedTo: row.promoted_to,
            qualitySignals: buildQualitySignals(row),
        };
    }
}

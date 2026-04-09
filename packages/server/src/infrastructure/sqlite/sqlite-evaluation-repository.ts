import type Database from "better-sqlite3";
import type { IEvaluationRepository, PersistedTaskEvaluation, StoredTaskEvaluation, WorkflowContentRecord, WorkflowSearchResult, WorkflowSummary } from "../../application/ports/index.js";
import type { MonitoringTask, ReusableTaskSnapshot, TaskId as MonitorTaskId, TimelineEvent, WorkflowEvaluationData } from "@monitor/core";
import { buildReusableTaskSnapshot, buildWorkflowContext, EventId, SessionId, TaskId, TaskSlug, WorkspacePath } from "@monitor/core";
import { deriveTaskDisplayTitle, meaningfulTaskTitle } from "../../application/services/task-display-title-resolver.helpers.js";
import type { IEmbeddingService } from "../embedding";
import { cosineSimilarity, deserializeEmbedding, EMBEDDING_MODEL, serializeEmbedding } from "../embedding";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "./drizzle-db.js";
import { parseJsonField } from "./sqlite-json.js";
const MIN_SEMANTIC_SCORE = 0.22;
interface EvaluationRow {
    task_id: string;
    rating: string;
    use_case: string | null;
    workflow_tags: string | null;
    outcome_note: string | null;
    approach_note: string | null;
    reuse_when: string | null;
    watchouts: string | null;
    workflow_snapshot_json: string | null;
    workflow_context: string | null;
    search_text: string | null;
    evaluated_at: string;
}
interface TaskWithEvaluationRow {
    task_id: string;
    title: string;
    slug: string;
    workspace_path: string | null;
    use_case: string | null;
    workflow_tags: string | null;
    outcome_note: string | null;
    approach_note: string | null;
    reuse_when: string | null;
    watchouts: string | null;
    workflow_snapshot_json: string | null;
    workflow_context: string | null;
    search_text: string | null;
    embedding: string | null;
    embedding_model: string | null;
    rating: string;
    event_count: number;
    created_at: string;
    evaluated_at: string;
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
interface RankedWorkflowRow {
    readonly row: TaskWithEvaluationRow;
    readonly lexicalScore: number;
    readonly semanticScore: number | null;
}
function mapEvaluationRow(row: EvaluationRow): StoredTaskEvaluation {
    return {
        taskId: TaskId(row.task_id),
        rating: row.rating as "good" | "skip",
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        approachNote: row.approach_note,
        reuseWhen: row.reuse_when,
        watchouts: row.watchouts,
        workflowSnapshot: row.workflow_snapshot_json
            ? parseJsonField<ReusableTaskSnapshot>(row.workflow_snapshot_json)
            : null,
        workflowContext: row.workflow_context,
        searchText: row.search_text,
        evaluatedAt: row.evaluated_at
    };
}
function mapEventRow(row: EventRow): TimelineEvent {
    return {
        id: EventId(row.id),
        taskId: TaskId(row.task_id),
        ...(row.session_id ? { sessionId: SessionId(row.session_id) } : {}),
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
    private readonly db: Database.Database;
    constructor(db: SqliteDatabaseInput, private readonly embeddingService?: IEmbeddingService) {
        this.db = ensureSqliteDatabase(db).client;
    }
    async upsertEvaluation(evaluation: PersistedTaskEvaluation): Promise<void> {
        this.db.prepare(`
      insert into task_evaluations (
        task_id, rating, use_case, workflow_tags, outcome_note, approach_note, reuse_when, watchouts,
        workflow_snapshot_json, workflow_context, search_text, evaluated_at
      )
      values (
        @taskId, @rating, @useCase, @workflowTags, @outcomeNote, @approachNote, @reuseWhen, @watchouts,
        @workflowSnapshotJson, @workflowContext, @searchText, @evaluatedAt
      )
      on conflict(task_id) do update set
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
        evaluated_at    = excluded.evaluated_at
    `).run({
            taskId: evaluation.taskId,
            rating: evaluation.rating,
            useCase: evaluation.useCase ?? null,
            workflowTags: evaluation.workflowTags.length > 0 ? JSON.stringify(evaluation.workflowTags) : null,
            outcomeNote: evaluation.outcomeNote ?? null,
            approachNote: evaluation.approachNote ?? null,
            reuseWhen: evaluation.reuseWhen ?? null,
            watchouts: evaluation.watchouts ?? null,
            workflowSnapshotJson: evaluation.workflowSnapshot
                ? JSON.stringify(evaluation.workflowSnapshot)
                : null,
            workflowContext: evaluation.workflowContext ?? null,
            searchText: evaluation.searchText ?? null,
            evaluatedAt: evaluation.evaluatedAt
        });
        if (this.embeddingService) {
            void this.generateAndSaveEmbedding(evaluation);
        }
    }
    async listEvaluations(rating?: "good" | "skip"): Promise<readonly WorkflowSummary[]> {
        const rows = this.loadSearchRows(undefined, rating);
        return [...rows]
            .sort(compareWorkflowSummaryRows)
            .map((row) => this.hydrateWorkflowSummary(row));
    }
    async getEvaluation(taskId: MonitorTaskId): Promise<StoredTaskEvaluation | null> {
        const row = this.db
            .prepare<{
            taskId: string;
        }, EvaluationRow>("select * from task_evaluations where task_id = @taskId")
            .get({ taskId });
        return row ? mapEvaluationRow(row) : null;
    }
    async getWorkflowContent(taskId: MonitorTaskId): Promise<WorkflowContentRecord | null> {
        const row = this.db.prepare<{
            taskId: string;
        }, TaskWithEvaluationRow>(`
      select
        e.task_id,
        t.title,
        t.slug,
        t.workspace_path,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.approach_note,
        e.reuse_when,
        e.watchouts,
        e.workflow_snapshot_json,
        e.workflow_context,
        e.search_text,
        e.embedding,
        e.embedding_model,
        e.rating,
        e.evaluated_at,
        count(ev.id) as event_count,
        t.created_at
      from task_evaluations e
      join monitoring_tasks t on t.id = e.task_id
      left join timeline_events ev on ev.task_id = e.task_id
      where e.task_id = @taskId
      group by e.task_id
    `).get({ taskId });
        if (!row) {
            return null;
        }
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
                .prepare<{
                taskId: string;
            }, {
                title: string;
            }>("select title from monitoring_tasks where id = @taskId")
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
                embeddingModel: EMBEDDING_MODEL
            });
        }
        catch (error) {
            if (isClosedDatabaseError(error)) {
                return;
            }
            console.warn("[monitor-server] embedding generation failed:", error instanceof Error ? error.message : error);
        }
    }
    private loadSearchRows(tags?: readonly string[], rating?: "good" | "skip"): readonly TaskWithEvaluationRow[] {
        const whereConditions = [
            rating ? "e.rating = @rating" : null
        ].filter((condition): condition is string => Boolean(condition));
        const whereClause = whereConditions.length > 0
            ? `where ${whereConditions.join(" and ")}`
            : "";
        const rows = this.db.prepare<{
            rating?: "good" | "skip";
        }, TaskWithEvaluationRow>(`
      select
        e.task_id,
        t.title,
        t.slug,
        t.workspace_path,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.approach_note,
        e.reuse_when,
        e.watchouts,
        e.workflow_snapshot_json,
        e.workflow_context,
        e.search_text,
        e.embedding,
        e.embedding_model,
        e.rating,
        e.evaluated_at,
        count(ev.id) as event_count,
        t.created_at
      from task_evaluations e
      join monitoring_tasks t on t.id = e.task_id
      left join timeline_events ev on ev.task_id = e.task_id
      ${whereClause}
      group by e.task_id
    `).all(rating ? { rating } : {});
        return applyTagFilter(rows, tags);
    }
    private async rankWorkflowRows(query: string, tags: readonly string[] | undefined, limit: number, rating?: "good" | "skip"): Promise<readonly TaskWithEvaluationRow[]> {
        const rows = this.loadSearchRows(tags, rating);
        if (rows.length === 0) {
            return [];
        }
        const lexicalMatches = scoreLexicalMatches(rows, query);
        let semanticMatches: readonly {
            row: TaskWithEvaluationRow;
            score: number;
        }[] = [];
        if (this.embeddingService && query.trim().length > 0) {
            try {
                semanticMatches = await this.scoreSemanticMatches(rows, query);
            }
            catch (error) {
                console.warn("[monitor-server] semantic workflow search failed; falling back to lexical search:", error instanceof Error ? error.message : error);
            }
        }
        return mergeRankedRows(semanticMatches, lexicalMatches, limit);
    }
    private async scoreSemanticMatches(rows: readonly TaskWithEvaluationRow[], query: string): Promise<readonly {
        row: TaskWithEvaluationRow;
        score: number;
    }[]> {
        const embeddedRows = rows.filter((row) => typeof row.embedding === "string" && row.embedding.length > 0);
        if (embeddedRows.length === 0) {
            return [];
        }
        const queryVector = await this.embeddingService!.embed(query);
        return embeddedRows
            .map((row) => ({
            row,
            score: cosineSimilarity(queryVector, deserializeEmbedding(row.embedding as string))
        }))
            .filter((entry) => entry.score >= MIN_SEMANTIC_SCORE)
            .sort((left, right) => right.score - left.score
            || compareRatedRows(left.row, right.row));
    }
    private hydrateSearchResult(row: TaskWithEvaluationRow): WorkflowSearchResult {
        const content = this.buildWorkflowContent(row);
        return {
            taskId: TaskId(row.task_id),
            title: row.title,
            ...(content.displayTitle ? { displayTitle: content.displayTitle } : {}),
            useCase: row.use_case,
            workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
            outcomeNote: row.outcome_note,
            approachNote: row.approach_note,
            reuseWhen: row.reuse_when,
            watchouts: row.watchouts,
            rating: row.rating as "good" | "skip",
            eventCount: row.event_count,
            createdAt: row.created_at,
            workflowContext: content.workflowContext
        };
    }
    private hydrateWorkflowSummary(row: TaskWithEvaluationRow): WorkflowSummary {
        return mapWorkflowSummary(row, this.resolveWorkflowDisplayTitle(row));
    }
    private hydrateWorkflowContent(row: TaskWithEvaluationRow): WorkflowContentRecord {
        return this.buildWorkflowContent(row);
    }
    private resolveWorkflowDisplayTitle(row: TaskWithEvaluationRow): string | undefined {
        const task = buildWorkflowTask(row);
        if (meaningfulTaskTitle(task)) {
            return undefined;
        }
        const events = this.loadWorkflowEvents(TaskId(row.task_id));
        return resolveWorkflowDisplayTitle(row, events);
    }
    private loadWorkflowEvents(taskId: MonitorTaskId): readonly TimelineEvent[] {
        const eventRows = this.db
            .prepare<{
            taskId: string;
        }, EventRow>("select * from timeline_events where task_id = @taskId order by created_at asc")
            .all({ taskId });
        return eventRows.map(mapEventRow);
    }
    private buildWorkflowContent(row: TaskWithEvaluationRow): WorkflowContentRecord {
        const events = this.loadWorkflowEvents(TaskId(row.task_id));
        const evaluation = buildEvaluationData(row);
        const displayTitle = resolveWorkflowDisplayTitle(row, events);
        const title = displayTitle ?? row.title;
        const generatedSnapshot = buildReusableTaskSnapshot({
            objective: title,
            events,
            evaluation
        });
        const storedSnapshot = row.workflow_snapshot_json
            ? parseJsonField<ReusableTaskSnapshot>(row.workflow_snapshot_json)
            : null;
        const workflowSnapshot = storedSnapshot ?? generatedSnapshot;
        const generatedContext = buildWorkflowContext(events, title, evaluation, workflowSnapshot);
        const workflowContext = row.workflow_context ?? generatedContext;
        const source = row.workflow_snapshot_json || row.workflow_context ? "saved" : "generated";
        return {
            taskId: TaskId(row.task_id),
            title: row.title,
            ...(displayTitle ? { displayTitle } : {}),
            workflowSnapshot,
            workflowContext,
            searchText: row.search_text ?? workflowSnapshot.searchText,
            source
        };
    }
}
function mergeRankedRows(semanticMatches: readonly {
    row: TaskWithEvaluationRow;
    score: number;
}[], lexicalMatches: readonly {
    row: TaskWithEvaluationRow;
    score: number;
}[], limit: number): readonly TaskWithEvaluationRow[] {
    const ranked = new Map<string, RankedWorkflowRow>();
    for (const semantic of semanticMatches) {
        ranked.set(semantic.row.task_id, {
            row: semantic.row,
            lexicalScore: 0,
            semanticScore: semantic.score
        });
    }
    for (const lexical of lexicalMatches) {
        const existing = ranked.get(lexical.row.task_id);
        if (existing) {
            ranked.set(lexical.row.task_id, {
                ...existing,
                lexicalScore: Math.max(existing.lexicalScore, lexical.score)
            });
            continue;
        }
        ranked.set(lexical.row.task_id, {
            row: lexical.row,
            lexicalScore: lexical.score,
            semanticScore: null
        });
    }
    return [...ranked.values()]
        .sort((left, right) => combinedRankScore(right) - combinedRankScore(left)
        || (right.semanticScore ?? 0) - (left.semanticScore ?? 0)
        || right.lexicalScore - left.lexicalScore
        || compareRatedRows(left.row, right.row))
        .slice(0, limit)
        .map((entry) => entry.row);
}
function mapWorkflowSummary(row: TaskWithEvaluationRow, displayTitle?: string): WorkflowSummary {
    return {
        taskId: TaskId(row.task_id),
        title: row.title,
        ...(displayTitle ? { displayTitle } : {}),
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        approachNote: row.approach_note,
        reuseWhen: row.reuse_when,
        watchouts: row.watchouts,
        rating: row.rating as "good" | "skip",
        eventCount: row.event_count,
        createdAt: row.created_at,
        evaluatedAt: row.evaluated_at
    };
}
function buildWorkflowTask(row: Pick<TaskWithEvaluationRow, "task_id" | "title" | "slug" | "workspace_path" | "created_at" | "evaluated_at">): MonitoringTask {
    return {
        id: TaskId(row.task_id),
        title: row.title,
        slug: TaskSlug(row.slug),
        status: "completed",
        createdAt: row.created_at,
        updatedAt: row.evaluated_at,
        ...(row.workspace_path ? { workspacePath: WorkspacePath(row.workspace_path) } : {})
    };
}
function resolveWorkflowDisplayTitle(row: Pick<TaskWithEvaluationRow, "task_id" | "title" | "slug" | "workspace_path" | "created_at" | "evaluated_at">, events: readonly TimelineEvent[]): string | undefined {
    const displayTitle = deriveTaskDisplayTitle(buildWorkflowTask(row), events);
    return displayTitle && displayTitle !== row.title
        ? displayTitle
        : undefined;
}
function combinedRankScore(entry: RankedWorkflowRow): number {
    return (entry.semanticScore ?? 0) * 100 + entry.lexicalScore;
}
function scoreLexicalMatches(rows: readonly TaskWithEvaluationRow[], query: string): readonly {
    row: TaskWithEvaluationRow;
    score: number;
}[] {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) {
        return [];
    }
    const queryTokens = tokenizeText(normalizedQuery);
    return rows
        .map((row) => ({
        row,
        score: computeLexicalScore(row, normalizedQuery, queryTokens)
    }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score
        || compareRatedRows(left.row, right.row));
}
function computeLexicalScore(row: TaskWithEvaluationRow, normalizedQuery: string, queryTokens: readonly string[]): number {
    const fields = buildSearchFields(row);
    const combinedText = fields
        .map((field) => field.value)
        .filter(Boolean)
        .join(" ");
    const matchedTokens = new Set<string>();
    let score = 0;
    if (combinedText.includes(normalizedQuery)) {
        score += 18;
    }
    for (const field of fields) {
        if (!field.value) {
            continue;
        }
        if (field.value.includes(normalizedQuery)) {
            score += field.weight * 2;
        }
        for (const token of queryTokens) {
            if (!field.value.includes(token)) {
                continue;
            }
            matchedTokens.add(token);
            score += field.weight;
        }
    }
    if (queryTokens.length > 1 && matchedTokens.size === queryTokens.length) {
        score += queryTokens.length * 4;
    }
    return score;
}
function buildSearchFields(row: TaskWithEvaluationRow): ReadonlyArray<{
    value: string;
    weight: number;
}> {
    const workflowTags = row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags).join(" ") : "";
    return [
        { value: normalizeSearchText(row.title) ?? "", weight: 12 },
        { value: normalizeSearchText(row.use_case) ?? "", weight: 10 },
        { value: normalizeSearchText(workflowTags) ?? "", weight: 8 },
        { value: normalizeSearchText(row.outcome_note) ?? "", weight: 7 },
        { value: normalizeSearchText(row.approach_note) ?? "", weight: 7 },
        { value: normalizeSearchText(row.reuse_when) ?? "", weight: 5 },
        { value: normalizeSearchText(row.watchouts) ?? "", weight: 5 },
        { value: normalizeSearchText(row.search_text) ?? "", weight: 6 }
    ];
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
function applyTagFilter<T extends {
    workflow_tags: string | null;
}>(rows: readonly T[], tags: readonly string[] | undefined): readonly T[] {
    if (!tags || tags.length === 0) {
        return rows;
    }
    return rows.filter((row) => {
        if (!row.workflow_tags) {
            return false;
        }
        const rowTags = parseJsonField<string[]>(row.workflow_tags);
        return tags.some((tag) => rowTags.some((rowTag) => rowTag.toLocaleLowerCase().includes(tag.toLocaleLowerCase())));
    });
}
function compareRatedRows(left: TaskWithEvaluationRow, right: TaskWithEvaluationRow): number {
    return Number(right.rating === "good") - Number(left.rating === "good")
        || compareIsoDatesDesc(left.evaluated_at, right.evaluated_at);
}
function compareWorkflowSummaryRows(left: TaskWithEvaluationRow, right: TaskWithEvaluationRow): number {
    return compareRatedRows(left, right);
}
function compareIsoDatesDesc(left: string, right: string): number {
    return Date.parse(right) - Date.parse(left);
}
function buildEvaluationData(value: Pick<TaskWithEvaluationRow, "use_case" | "workflow_tags" | "outcome_note" | "approach_note" | "reuse_when" | "watchouts"> | Pick<PersistedTaskEvaluation, "useCase" | "workflowTags" | "outcomeNote" | "approachNote" | "reuseWhen" | "watchouts">): WorkflowEvaluationData {
    if ("use_case" in value) {
        return {
            useCase: value.use_case,
            workflowTags: value.workflow_tags ? parseJsonField<string[]>(value.workflow_tags) : [],
            outcomeNote: value.outcome_note,
            approachNote: value.approach_note,
            reuseWhen: value.reuse_when,
            watchouts: value.watchouts
        };
    }
    return {
        useCase: value.useCase ?? null,
        workflowTags: value.workflowTags,
        outcomeNote: value.outcomeNote ?? null,
        approachNote: value.approachNote ?? null,
        reuseWhen: value.reuseWhen ?? null,
        watchouts: value.watchouts ?? null
    };
}
function buildEmbeddingText(evaluation: PersistedTaskEvaluation, events: readonly TimelineEvent[], title: string): string {
    const workflowSnapshot = evaluation.workflowSnapshot ?? buildReusableTaskSnapshot({
        objective: title,
        events,
        evaluation: buildEvaluationData(evaluation)
    });
    const workflowContext = evaluation.workflowContext
        ?? buildWorkflowContext(events, title, buildEvaluationData(evaluation), workflowSnapshot);
    const parts = [
        title,
        evaluation.useCase,
        evaluation.workflowTags.join(" "),
        evaluation.outcomeNote,
        evaluation.approachNote,
        evaluation.reuseWhen,
        evaluation.watchouts,
        evaluation.searchText ?? workflowSnapshot.searchText,
        workflowContext
    ];
    return parts
        .map((part) => normalizeEmbeddingSection(part))
        .filter((part): part is string => Boolean(part))
        .join("\n\n");
}
function normalizeEmbeddingSection(value?: string | null): string | null {
    if (!value) {
        return null;
    }
    const normalized = value.replace(/\s+/g, " ").trim();
    if (!normalized) {
        return null;
    }
    return normalized.slice(0, 1600);
}
function isClosedDatabaseError(error: unknown): boolean {
    return error instanceof Error && /database connection is not open/i.test(error.message);
}

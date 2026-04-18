import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { BriefingSaveInput, IEmbeddingService, IEvaluationRepository, PersistedTaskEvaluation, PlaybookUpsertInput, StoredTaskEvaluation, WorkflowContentRecord, WorkflowSearchResult, WorkflowSummary } from "@monitor/application";
import type { MonitoringTask, PlaybookRecord, PlaybookStatus, PlaybookSummary, ReusableTaskSnapshot, SavedBriefing, TaskId as MonitorTaskId, TimelineEvent, WorkflowEvaluationData } from "@monitor/domain";
import { buildReusableTaskSnapshot, buildWorkflowContext, EventId, filterEventsByTurnRange, segmentEventsByTurn, SessionId, TaskId, TaskSlug, WorkspacePath } from "@monitor/domain";
import { deriveTaskDisplayTitle, meaningfulTaskTitle } from "@monitor/application";
import { cosineSimilarity, deserializeEmbedding, serializeEmbedding } from "./embedding-codec.js";
import { ensureSqliteDatabase, type SqliteDatabaseInput } from "./drizzle-db.js";
import { parseJsonField } from "./sqlite-json.js";
const MIN_SEMANTIC_SCORE = 0.22;
interface EvaluationRow {
    task_id: string;
    scope_key: string;
    scope_kind: string;
    scope_label: string;
    turn_index: number | null;
    rating: string;
    use_case: string | null;
    workflow_tags: string | null;
    outcome_note: string | null;
    approach_note: string | null;
    reuse_when: string | null;
    watchouts: string | null;
    version: number;
    promoted_to: string | null;
    reuse_count: number;
    last_reused_at: string | null;
    briefing_copy_count: number;
    workflow_snapshot_json: string | null;
    workflow_context: string | null;
    search_text: string | null;
    evaluated_at: string;
}
interface TaskWithEvaluationRow {
    task_id: string;
    scope_key: string;
    scope_kind: string;
    scope_label: string;
    turn_index: number | null;
    title: string;
    slug: string;
    workspace_path: string | null;
    use_case: string | null;
    workflow_tags: string | null;
    outcome_note: string | null;
    approach_note: string | null;
    reuse_when: string | null;
    watchouts: string | null;
    version: number;
    promoted_to: string | null;
    reuse_count: number;
    last_reused_at: string | null;
    briefing_copy_count: number;
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
interface PlaybookRow {
    id: string;
    title: string;
    slug: string;
    status: string;
    when_to_use: string | null;
    prerequisites: string | null;
    approach: string | null;
    key_steps: string | null;
    watchouts: string | null;
    anti_patterns: string | null;
    failure_modes: string | null;
    variants: string | null;
    related_playbook_ids: string | null;
    source_snapshot_ids: string | null;
    tags: string | null;
    search_text: string | null;
    embedding: string | null;
    embedding_model: string | null;
    use_count: number;
    last_used_at: string | null;
    created_at: string;
    updated_at: string;
}
interface RankedPlaybookRow {
    readonly row: PlaybookRow;
    readonly lexicalScore: number;
    readonly semanticScore: number | null;
}
interface BriefingRow {
    id: string;
    task_id: string;
    generated_at: string;
    purpose: string;
    format: string;
    memo: string | null;
    content: string;
}
function mapEvaluationRow(row: EvaluationRow): StoredTaskEvaluation {
    return {
        taskId: TaskId(row.task_id),
        scopeKey: row.scope_key,
        scopeKind: row.scope_kind as "task" | "turn",
        scopeLabel: row.scope_label,
        turnIndex: row.turn_index,
        rating: row.rating as "good" | "skip",
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        approachNote: row.approach_note,
        reuseWhen: row.reuse_when,
        watchouts: row.watchouts,
        version: row.version,
        promotedTo: row.promoted_to,
        qualitySignals: buildQualitySignals(row),
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
function mapBriefingRow(row: BriefingRow): SavedBriefing {
    return {
        id: row.id,
        taskId: TaskId(row.task_id),
        generatedAt: row.generated_at,
        purpose: row.purpose as SavedBriefing["purpose"],
        format: row.format as SavedBriefing["format"],
        memo: row.memo,
        content: row.content
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
    async recordBriefingCopy(taskId: MonitorTaskId, copiedAt: string, scopeKey = "task"): Promise<void> {
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
    async saveBriefing(taskId: MonitorTaskId, briefing: BriefingSaveInput): Promise<SavedBriefing> {
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
            content: briefing.content
        });
        return {
            id,
            taskId: TaskId(taskId),
            generatedAt: briefing.generatedAt,
            purpose: briefing.purpose,
            format: briefing.format,
            memo: briefing.memo ?? null,
            content: briefing.content
        };
    }
    async listBriefings(taskId: MonitorTaskId): Promise<readonly SavedBriefing[]> {
        const rows = this.db.prepare<{
            taskId: string;
        }, BriefingRow>(`
          select * from briefings
          where task_id = @taskId
          order by generated_at desc
        `).all({ taskId });
        return rows.map(mapBriefingRow);
    }
    async listEvaluations(rating?: "good" | "skip"): Promise<readonly WorkflowSummary[]> {
        const rows = this.loadSearchRows(undefined, rating);
        return [...rows]
            .sort(compareWorkflowSummaryRows)
            .map((row) => this.hydrateWorkflowSummary(row));
    }
    async getEvaluation(taskId: MonitorTaskId, scopeKey = "task"): Promise<StoredTaskEvaluation | null> {
        const row = this.db
            .prepare<{
            taskId: string;
            scopeKey: string;
        }, EvaluationRow>("select * from task_evaluations where task_id = @taskId and scope_key = @scopeKey")
            .get({ taskId, scopeKey });
        return row ? mapEvaluationRow(row) : null;
    }
    async getWorkflowContent(taskId: MonitorTaskId, scopeKey = "task"): Promise<WorkflowContentRecord | null> {
        const row = this.db.prepare<{
            taskId: string;
            scopeKey: string;
        }, TaskWithEvaluationRow>(`
      select
        e.task_id,
        e.scope_key,
        e.scope_kind,
        e.scope_label,
        e.turn_index,
        t.title,
        t.slug,
        t.workspace_path,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.approach_note,
        e.reuse_when,
        e.watchouts,
        e.version,
        e.promoted_to,
        e.reuse_count,
        e.last_reused_at,
        e.briefing_copy_count,
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
      where e.task_id = @taskId and e.scope_key = @scopeKey
      group by e.task_id, e.scope_key
    `).get({ taskId, scopeKey });
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
    async listPlaybooks(query?: string, status?: PlaybookStatus, limit = 50): Promise<readonly PlaybookSummary[]> {
        const effectiveLimit = Math.min(Math.max(limit, 1), 100);
        const rows: readonly PlaybookRow[] = query?.trim()
            ? await this.rankPlaybookRows(query, effectiveLimit, status)
            : [...this.loadPlaybookRows(status)]
                .sort((left, right) => comparePlaybookRows(left, right))
                .slice(0, effectiveLimit);
        return rows.map((row) => mapPlaybookSummary(row));
    }
    async getPlaybook(playbookId: string): Promise<PlaybookRecord | null> {
        const row = this.db.prepare<{
            playbookId: string;
        }, PlaybookRow>("select * from playbooks where id = @playbookId").get({ playbookId });
        return row ? mapPlaybookRecord(row) : null;
    }
    async createPlaybook(input: PlaybookUpsertInput): Promise<PlaybookRecord> {
        const id = `playbook-${randomUUID()}`;
        const now = new Date().toISOString();
        const title = input.title.trim();
        const slug = this.ensureUniquePlaybookSlug(createPlaybookSlug(title));
        const payload = normalizePlaybookPayload(input, now);
        this.db.prepare(`
          insert into playbooks (
            id, title, slug, status, when_to_use, prerequisites, approach, key_steps, watchouts,
            anti_patterns, failure_modes, variants, related_playbook_ids, source_snapshot_ids, tags,
            search_text, embedding, embedding_model, use_count, last_used_at, created_at, updated_at
          ) values (
            @id, @title, @slug, @status, @whenToUse, @prerequisites, @approach, @keySteps, @watchouts,
            @antiPatterns, @failureModes, @variants, @relatedPlaybookIds, @sourceSnapshotIds, @tags,
            @searchText, null, null, 0, null, @createdAt, @updatedAt
          )
        `).run({
            id,
            title,
            slug,
            ...payload
        });
        this.updatePromotedSnapshots(payload.sourceSnapshotIdsList, id);
        if (this.embeddingService) {
            void this.generateAndSavePlaybookEmbedding(id, buildPlaybookEmbeddingText({
                id,
                title,
                slug,
                ...payload
            }));
        }
        return (await this.getPlaybook(id)) as PlaybookRecord;
    }
    async updatePlaybook(playbookId: string, input: Partial<PlaybookUpsertInput>): Promise<PlaybookRecord | null> {
        const existing = await this.getPlaybook(playbookId);
        if (!existing) {
            return null;
        }
        const title = input.title?.trim() || existing.title;
        const slug = title === existing.title ? existing.slug : this.ensureUniquePlaybookSlug(createPlaybookSlug(title), playbookId);
        const merged = normalizePlaybookPayload({
            title,
            status: input.status ?? existing.status,
            whenToUse: input.whenToUse ?? existing.whenToUse,
            prerequisites: input.prerequisites ?? existing.prerequisites,
            approach: input.approach ?? existing.approach,
            keySteps: input.keySteps ?? existing.keySteps,
            watchouts: input.watchouts ?? existing.watchouts,
            antiPatterns: input.antiPatterns ?? existing.antiPatterns,
            failureModes: input.failureModes ?? existing.failureModes,
            variants: input.variants ?? existing.variants,
            relatedPlaybookIds: input.relatedPlaybookIds ?? existing.relatedPlaybookIds,
            sourceSnapshotIds: input.sourceSnapshotIds ?? existing.sourceSnapshotIds,
            tags: input.tags ?? existing.tags
        }, new Date().toISOString(), existing.createdAt);
        this.db.prepare(`
          update playbooks
          set title = @title,
              slug = @slug,
              status = @status,
              when_to_use = @whenToUse,
              prerequisites = @prerequisites,
              approach = @approach,
              key_steps = @keySteps,
              watchouts = @watchouts,
              anti_patterns = @antiPatterns,
              failure_modes = @failureModes,
              variants = @variants,
              related_playbook_ids = @relatedPlaybookIds,
              source_snapshot_ids = @sourceSnapshotIds,
              tags = @tags,
              search_text = @searchText,
              updated_at = @updatedAt
          where id = @id
        `).run({
            id: playbookId,
            title,
            slug,
            ...merged
        });
        this.updatePromotedSnapshots(merged.sourceSnapshotIdsList, playbookId);
        if (this.embeddingService) {
            void this.generateAndSavePlaybookEmbedding(playbookId, buildPlaybookEmbeddingText({
                id: playbookId,
                title,
                slug,
                ...merged
            }));
        }
        return this.getPlaybook(playbookId);
    }
    private loadPlaybookRows(status?: PlaybookStatus): readonly PlaybookRow[] {
        const whereClause = status ? "where status = @status" : "";
        return this.db.prepare<{
            status?: PlaybookStatus;
        }, PlaybookRow>(`
          select * from playbooks
          ${whereClause}
        `).all(status ? { status } : {});
    }
    private async rankPlaybookRows(query: string, limit: number, status?: PlaybookStatus): Promise<readonly PlaybookRow[]> {
        const rows = this.loadPlaybookRows(status);
        if (rows.length === 0) {
            return [];
        }
        const lexicalMatches = scoreLexicalMatches(rows, query);
        let semanticMatches: readonly {
            row: PlaybookRow;
            score: number;
        }[] = [];
        if (this.embeddingService && query.trim().length > 0) {
            try {
                semanticMatches = await this.scoreSemanticPlaybookMatches(rows, query);
            }
            catch (error) {
                console.warn("[monitor-server] semantic playbook search failed; falling back to lexical search:", error instanceof Error ? error.message : error);
            }
        }
        return mergeRankedPlaybookRows(semanticMatches, lexicalMatches, limit);
    }
    private async scoreSemanticPlaybookMatches(rows: readonly PlaybookRow[], query: string): Promise<readonly {
        row: PlaybookRow;
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
            .sort((left, right) => right.score - left.score || comparePlaybookRows(left.row, right.row));
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
                embeddingModel: this.embeddingService!.modelId
            });
        }
        catch (error) {
            if (isClosedDatabaseError(error)) {
                return;
            }
            console.warn("[monitor-server] embedding generation failed:", error instanceof Error ? error.message : error);
        }
    }
    private async generateAndSavePlaybookEmbedding(playbookId: string, embeddingText: string): Promise<void> {
        try {
            const vector = await this.embeddingService!.embed(embeddingText);
            this.db.prepare(`
              update playbooks
              set embedding = @embedding,
                  embedding_model = @embeddingModel
              where id = @playbookId
            `).run({
                playbookId,
                embedding: serializeEmbedding(vector),
                embeddingModel: this.embeddingService!.modelId
            });
        }
        catch (error) {
            if (isClosedDatabaseError(error)) {
                return;
            }
            console.warn("[monitor-server] playbook embedding generation failed:", error instanceof Error ? error.message : error);
        }
    }
    private ensureUniquePlaybookSlug(baseSlug: string, ignoreId?: string): string {
        const fallbackSlug = baseSlug || "playbook";
        let slug = fallbackSlug;
        let suffix = 2;
        const MAX_SLUG_ATTEMPTS = 200;
        for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
            const existing = this.db.prepare<{
                slug: string;
                ignoreId?: string;
            }, {
                id: string;
            }>(ignoreId
                ? "select id from playbooks where slug = @slug and id != @ignoreId"
                : "select id from playbooks where slug = @slug")
                .get(ignoreId ? { slug, ignoreId } : { slug });
            if (!existing) {
                return slug;
            }
            slug = `${fallbackSlug}-${suffix++}`;
        }
        throw new Error(`Could not generate a unique slug for "${baseSlug}" after ${MAX_SLUG_ATTEMPTS} attempts`);
    }
    private updatePromotedSnapshots(snapshotIds: readonly string[], playbookId: string): void {
        const snapshotRefs = uniqueSnapshotRefs(snapshotIds.map(parseSnapshotReference).filter((value): value is SnapshotReference => Boolean(value)));
        if (snapshotRefs.length === 0) {
            return;
        }
        const statement = this.db.prepare(`
          update task_evaluations
          set promoted_to = @playbookId
          where task_id = @taskId and scope_key = @scopeKey
        `);
        for (const ref of snapshotRefs) {
            statement.run({ playbookId, taskId: ref.taskId, scopeKey: ref.scopeKey });
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
        e.scope_key,
        e.scope_kind,
        e.scope_label,
        e.turn_index,
        t.title,
        t.slug,
        t.workspace_path,
        e.use_case,
        e.workflow_tags,
        e.outcome_note,
        e.approach_note,
        e.reuse_when,
        e.watchouts,
        e.version,
        e.promoted_to,
        e.reuse_count,
        e.last_reused_at,
        e.briefing_copy_count,
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
      group by e.task_id, e.scope_key
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
        const eventCount = this.loadWorkflowEvents(TaskId(row.task_id), row.scope_key).length;
        return {
            layer: "snapshot",
            snapshotId: buildSnapshotId(row.task_id, row.scope_key),
            taskId: TaskId(row.task_id),
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
            qualitySignals: buildQualitySignals(row)
        };
    }
    private hydrateWorkflowSummary(row: TaskWithEvaluationRow): WorkflowSummary {
        const eventCount = this.loadWorkflowEvents(TaskId(row.task_id), row.scope_key).length;
        return mapWorkflowSummary(row, eventCount, this.resolveWorkflowDisplayTitle(row));
    }
    private hydrateWorkflowContent(row: TaskWithEvaluationRow): WorkflowContentRecord {
        return this.buildWorkflowContent(row);
    }
    private resolveWorkflowDisplayTitle(row: TaskWithEvaluationRow): string | undefined {
        const task = buildWorkflowTask(row);
        if (meaningfulTaskTitle(task)) {
            return undefined;
        }
        const events = this.loadWorkflowEvents(TaskId(row.task_id), row.scope_key);
        return resolveWorkflowDisplayTitle(row, events);
    }
    private loadWorkflowEvents(taskId: MonitorTaskId, scopeKey = "task"): readonly TimelineEvent[] {
        const eventRows = this.db
            .prepare<{
            taskId: string;
        }, EventRow>("select * from timeline_events where task_id = @taskId order by created_at asc")
            .all({ taskId });
        const events = eventRows.map(mapEventRow);
        return filterWorkflowEventsForScopeKey(events, scopeKey);
    }
    private buildWorkflowContent(row: TaskWithEvaluationRow): WorkflowContentRecord {
        const events = this.loadWorkflowEvents(TaskId(row.task_id), row.scope_key);
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
            snapshotId: buildSnapshotId(row.task_id, row.scope_key),
            taskId: TaskId(row.task_id),
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
            qualitySignals: buildQualitySignals(row)
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
        ranked.set(buildSnapshotId(semantic.row.task_id, semantic.row.scope_key), {
            row: semantic.row,
            lexicalScore: 0,
            semanticScore: semantic.score
        });
    }
    for (const lexical of lexicalMatches) {
        const rankKey = buildSnapshotId(lexical.row.task_id, lexical.row.scope_key);
        const existing = ranked.get(rankKey);
        if (existing) {
            ranked.set(rankKey, {
                ...existing,
                lexicalScore: Math.max(existing.lexicalScore, lexical.score)
            });
            continue;
        }
        ranked.set(rankKey, {
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
function mergeRankedPlaybookRows(semanticMatches: readonly {
    row: PlaybookRow;
    score: number;
}[], lexicalMatches: readonly {
    row: PlaybookRow;
    score: number;
}[], limit: number): readonly PlaybookRow[] {
    const ranked = new Map<string, RankedPlaybookRow>();
    for (const semantic of semanticMatches) {
        ranked.set(semantic.row.id, {
            row: semantic.row,
            lexicalScore: 0,
            semanticScore: semantic.score
        });
    }
    for (const lexical of lexicalMatches) {
        const existing = ranked.get(lexical.row.id);
        if (existing) {
            ranked.set(lexical.row.id, {
                ...existing,
                lexicalScore: Math.max(existing.lexicalScore, lexical.score)
            });
            continue;
        }
        ranked.set(lexical.row.id, {
            row: lexical.row,
            lexicalScore: lexical.score,
            semanticScore: null
        });
    }
    return [...ranked.values()]
        .sort((left, right) => combinedPlaybookRankScore(right) - combinedPlaybookRankScore(left)
        || (right.semanticScore ?? 0) - (left.semanticScore ?? 0)
        || right.lexicalScore - left.lexicalScore
        || comparePlaybookRows(left.row, right.row))
        .slice(0, limit)
        .map((entry) => entry.row);
}
function mapWorkflowSummary(row: TaskWithEvaluationRow, eventCount: number, displayTitle?: string): WorkflowSummary {
    return {
        layer: "snapshot",
        snapshotId: buildSnapshotId(row.task_id, row.scope_key),
        taskId: TaskId(row.task_id),
        scopeKey: row.scope_key,
        scopeKind: row.scope_kind as "task" | "turn",
        scopeLabel: row.scope_label,
        turnIndex: row.turn_index,
        title: row.title,
        ...(displayTitle ? { displayTitle } : {}),
        useCase: row.use_case,
        workflowTags: row.workflow_tags ? parseJsonField<string[]>(row.workflow_tags) : [],
        outcomeNote: row.outcome_note,
        approachNote: row.approach_note,
        reuseWhen: row.reuse_when,
        watchouts: row.watchouts,
        rating: row.rating as "good" | "skip",
        eventCount,
        createdAt: row.created_at,
        evaluatedAt: row.evaluated_at,
        version: row.version,
        promotedTo: row.promoted_to,
        qualitySignals: buildQualitySignals(row)
    };
}
function mapPlaybookSummary(row: PlaybookRow): PlaybookSummary {
    return {
        layer: "playbook",
        id: row.id,
        title: row.title,
        slug: row.slug,
        status: row.status as PlaybookStatus,
        whenToUse: row.when_to_use,
        tags: parseJsonList(row.tags),
        useCount: row.use_count,
        lastUsedAt: row.last_used_at,
        sourceSnapshotIds: parseJsonList(row.source_snapshot_ids),
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
function mapPlaybookRecord(row: PlaybookRow): PlaybookRecord {
    return {
        ...mapPlaybookSummary(row),
        prerequisites: parseJsonList(row.prerequisites),
        approach: row.approach,
        keySteps: parseJsonList(row.key_steps),
        watchouts: parseJsonList(row.watchouts),
        antiPatterns: parseJsonList(row.anti_patterns),
        failureModes: parseJsonList(row.failure_modes),
        variants: row.variants ? parseJsonField<PlaybookRecord["variants"]>(row.variants) : [],
        relatedPlaybookIds: parseJsonList(row.related_playbook_ids),
        searchText: row.search_text
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
function combinedPlaybookRankScore(entry: RankedPlaybookRow): number {
    return (entry.semanticScore ?? 0) * 100 + entry.lexicalScore;
}
function scoreLexicalMatches<T extends TaskWithEvaluationRow | PlaybookRow>(rows: readonly T[], query: string): readonly {
    row: T;
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
        || compareSearchRows(left.row, right.row));
}
function computeLexicalScore<T extends TaskWithEvaluationRow | PlaybookRow>(row: T, normalizedQuery: string, queryTokens: readonly string[]): number {
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
function buildSearchFields(row: TaskWithEvaluationRow | PlaybookRow): ReadonlyArray<{
    value: string;
    weight: number;
}> {
    if ("task_id" in row) {
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
    const tags = row.tags ? parseJsonField<string[]>(row.tags).join(" ") : "";
    return [
        { value: normalizeSearchText(row.title) ?? "", weight: 12 },
        { value: normalizeSearchText(row.when_to_use) ?? "", weight: 10 },
        { value: normalizeSearchText(tags) ?? "", weight: 8 },
        { value: normalizeSearchText(row.approach) ?? "", weight: 7 },
        { value: normalizeSearchText(row.watchouts) ?? "", weight: 6 },
        { value: normalizeSearchText(row.key_steps) ?? "", weight: 6 },
        { value: normalizeSearchText(row.failure_modes) ?? "", weight: 5 },
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
function compareSearchRows(left: TaskWithEvaluationRow | PlaybookRow, right: TaskWithEvaluationRow | PlaybookRow): number {
    if ("task_id" in left && "task_id" in right) {
        return compareRatedRows(left, right);
    }
    if (!("task_id" in left) && !("task_id" in right)) {
        return comparePlaybookRows(left, right);
    }
    return "task_id" in left ? 1 : -1;
}
function compareRatedRows(left: TaskWithEvaluationRow, right: TaskWithEvaluationRow): number {
    return Number(right.rating === "good") - Number(left.rating === "good")
        || compareIsoDatesDesc(left.evaluated_at, right.evaluated_at);
}
function comparePlaybookRows(left: PlaybookRow, right: PlaybookRow): number {
    return playbookStatusRank(right.status) - playbookStatusRank(left.status)
        || compareIsoDatesDesc(left.updated_at, right.updated_at);
}
function playbookStatusRank(status: string): number {
    switch (status) {
        case "active":
            return 3;
        case "draft":
            return 2;
        case "archived":
            return 1;
        default:
            return 0;
    }
}
function buildQualitySignals(row: Pick<TaskWithEvaluationRow, "reuse_count" | "last_reused_at" | "briefing_copy_count" | "rating"> | EvaluationRow): WorkflowSummary["qualitySignals"] {
    return {
        reuseCount: row.reuse_count,
        lastReusedAt: row.last_reused_at,
        briefingCopyCount: row.briefing_copy_count,
        manualRating: row.rating as "good" | "skip"
    };
}
function parseJsonList(raw: string | null | undefined): readonly string[] {
    return raw ? parseJsonField<string[]>(raw) : [];
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
function normalizePlaybookPayload(input: Partial<PlaybookUpsertInput>, updatedAt: string, createdAt = updatedAt) {
    const title = input.title?.trim() ?? "Untitled playbook";
    const whenToUse = normalizeOptionalText(input.whenToUse);
    const approach = normalizeOptionalText(input.approach);
    const prerequisites = normalizeStringList(input.prerequisites);
    const keySteps = normalizeStringList(input.keySteps);
    const watchouts = normalizeStringList(input.watchouts);
    const antiPatterns = normalizeStringList(input.antiPatterns);
    const failureModes = normalizeStringList(input.failureModes);
    const relatedPlaybookIds = normalizeStringList(input.relatedPlaybookIds);
    const sourceSnapshotIds = normalizeStringList(input.sourceSnapshotIds);
    const tags = normalizeStringList(input.tags);
    const variants = normalizeVariants(input.variants);
    return {
        status: input.status ?? "draft",
        whenToUse,
        prerequisites: prerequisites.length > 0 ? JSON.stringify(prerequisites) : null,
        approach,
        keySteps: keySteps.length > 0 ? JSON.stringify(keySteps) : null,
        watchouts: watchouts.length > 0 ? JSON.stringify(watchouts) : null,
        antiPatterns: antiPatterns.length > 0 ? JSON.stringify(antiPatterns) : null,
        failureModes: failureModes.length > 0 ? JSON.stringify(failureModes) : null,
        variants: variants.length > 0 ? JSON.stringify(variants) : null,
        relatedPlaybookIds: relatedPlaybookIds.length > 0 ? JSON.stringify(relatedPlaybookIds) : null,
        sourceSnapshotIds: sourceSnapshotIds.length > 0 ? JSON.stringify(sourceSnapshotIds) : null,
        sourceSnapshotIdsList: sourceSnapshotIds,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        searchText: buildPlaybookSearchText({
            title,
            whenToUse,
            approach,
            prerequisites,
            keySteps,
            watchouts,
            antiPatterns,
            failureModes,
            tags
        }),
        createdAt,
        updatedAt
    };
}
function buildPlaybookEmbeddingText(input: {
    id?: string;
    title: string;
    slug: string;
    whenToUse?: string | null;
    approach?: string | null;
    prerequisites?: string | null;
    keySteps?: string | null;
    watchouts?: string | null;
    antiPatterns?: string | null;
    failureModes?: string | null;
    tags?: string | null;
    searchText?: string | null;
}): string {
    return [
        input.title,
        input.slug,
        input.whenToUse,
        input.approach,
        input.prerequisites,
        input.keySteps,
        input.watchouts,
        input.antiPatterns,
        input.failureModes,
        input.tags,
        input.searchText
    ]
        .map((part) => normalizeEmbeddingSection(part))
        .filter((part): part is string => Boolean(part))
        .join("\n\n");
}
function buildPlaybookSearchText(input: {
    title: string;
    whenToUse: string | null;
    approach: string | null;
    prerequisites: readonly string[];
    keySteps: readonly string[];
    watchouts: readonly string[];
    antiPatterns: readonly string[];
    failureModes: readonly string[];
    tags: readonly string[];
}): string {
    return [
        input.title,
        input.whenToUse,
        input.approach,
        input.prerequisites.join(" "),
        input.keySteps.join(" "),
        input.watchouts.join(" "),
        input.antiPatterns.join(" "),
        input.failureModes.join(" "),
        input.tags.join(" ")
    ]
        .map((part) => normalizeOptionalText(part))
        .filter((part): part is string => Boolean(part))
        .join(" ");
}
function normalizeStringList(values?: readonly string[] | null): readonly string[] {
    if (!values) {
        return [];
    }
    return uniqueStrings(values
        .map((value) => normalizeOptionalText(value))
        .filter((value): value is string => Boolean(value)));
}
function normalizeVariants(values?: PlaybookRecord["variants"] | null): PlaybookRecord["variants"] {
    if (!values) {
        return [];
    }
    return values
        .map((variant) => ({
        label: normalizeOptionalText(variant.label),
        description: normalizeOptionalText(variant.description),
        differenceFromBase: normalizeOptionalText(variant.differenceFromBase)
    }))
        .filter((variant): variant is {
        label: string;
        description: string;
        differenceFromBase: string;
    } => Boolean(variant.label && variant.description && variant.differenceFromBase));
}
function normalizeOptionalText(value?: string | null): string | null {
    if (!value) {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
function createPlaybookSlug(title: string): string {
    return title
        .toLocaleLowerCase()
        .normalize("NFKC")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}
type SnapshotReference = {
    readonly taskId: string;
    readonly scopeKey: string;
};

function buildSnapshotId(taskId: string, scopeKey: string): string {
    return `${taskId}#${scopeKey}`;
}

function parseSnapshotReference(snapshotId: string): SnapshotReference | null {
    const trimmed = snapshotId.trim();
    if (!trimmed) {
        return null;
    }
    const versionSeparator = trimmed.lastIndexOf(":v");
    const withoutVersion = versionSeparator >= 0 ? trimmed.slice(0, versionSeparator) : trimmed;
    const scopeSeparator = withoutVersion.indexOf("#");
    if (scopeSeparator === -1) {
        return {
            taskId: withoutVersion,
            scopeKey: "task",
        };
    }
    const taskId = withoutVersion.slice(0, scopeSeparator);
    const scopeKey = withoutVersion.slice(scopeSeparator + 1);
    if (!taskId || !scopeKey) {
        return null;
    }
    return { taskId, scopeKey };
}

function uniqueSnapshotRefs(values: readonly SnapshotReference[]): readonly SnapshotReference[] {
    const seen = new Set<string>();
    const result: SnapshotReference[] = [];
    for (const value of values) {
        const key = `${value.taskId}#${value.scopeKey}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(value);
    }
    return result;
}

function filterWorkflowEventsForScopeKey(events: readonly TimelineEvent[], scopeKey: string): readonly TimelineEvent[] {
    if (scopeKey === "task") {
        return events;
    }
    if (scopeKey === "last-turn") {
        const segments = segmentEventsByTurn(events).filter((segment) => !segment.isPrelude);
        const lastTurn = segments[segments.length - 1];
        if (!lastTurn) {
            return events;
        }
        return filterEventsByTurnRange(events, { from: lastTurn.turnIndex, to: lastTurn.turnIndex });
    }
    const turnMatch = /^turn:(\d+)$/.exec(scopeKey);
    if (!turnMatch) {
        return events;
    }
    const turnIndex = Number.parseInt(turnMatch[1] ?? "", 10);
    if (!Number.isFinite(turnIndex)) {
        return events;
    }
    return filterEventsByTurnRange(events, { from: turnIndex, to: turnIndex });
}

function uniqueStrings(values: readonly string[]): readonly string[] {
    return [...new Set(values)];
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

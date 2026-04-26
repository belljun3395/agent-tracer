import type Database from "better-sqlite3";
import type { EventClassification, TimelineEvent } from "~domain/monitoring/index.js";
import type { MonitoringEventKind, TimelineLane } from "~domain/monitoring/index.js";
import { QUESTION_PHASES, TODO_STATES } from "~domain/monitoring/index.js";
import { isEventRelationType } from "~domain/monitoring/index.js";
import { normalizeLane } from "~domain/monitoring/index.js";
import { parseJsonField } from "../shared/sqlite.json";

const SEMANTIC_METADATA_KEYS = [
    "subtypeKey",
    "subtypeLabel",
    "subtypeGroup",
    "toolFamily",
    "operation",
    "sourceTool",
    "toolName",
    "entityType",
    "entityName",
    "displayTitle",
    "evidenceLevel",
] as const;

const DERIVED_METADATA_KEYS = new Set<string>([
    ...SEMANTIC_METADATA_KEYS,
    "filePath",
    "filePaths",
    "relPath",
    "writeCount",
    "parentEventId",
    "sourceEventId",
    "relatedEventIds",
    "relationType",
    "relationLabel",
    "relationExplanation",
    "asyncTaskId",
    "asyncStatus",
    "asyncAgent",
    "asyncCategory",
    "ruleId",
    "ruleStatus",
    "rulePolicy",
    "ruleOutcome",
    "verificationStatus",
    "todoId",
    "todoState",
    "priority",
    "autoReconciled",
    "questionId",
    "questionPhase",
    "sequence",
    "modelName",
    "modelProvider",
    "inputTokens",
    "outputTokens",
    "cacheReadTokens",
    "cacheCreateTokens",
    "costUsd",
    "durationMs",
    "model",
    "promptId",
    "stopReason",
    "stop_reason",
    "tags",
]);

const TODO_STATE_SET = new Set<string>(TODO_STATES);
const QUESTION_PHASE_SET = new Set<string>(QUESTION_PHASES);

export interface EventStorageInput {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string | undefined;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string | undefined;
    readonly metadata: Record<string, unknown>;
    readonly classification?: EventClassification | undefined;
    readonly createdAt: string;
}

export interface EventStorageValues {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId: string | null;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body: string | null;
    readonly subtypeKey: string | null;
    readonly subtypeLabel: string | null;
    readonly subtypeGroup: string | null;
    readonly toolFamily: string | null;
    readonly operation: string | null;
    readonly sourceTool: string | null;
    readonly toolName: string | null;
    readonly entityType: string | null;
    readonly entityName: string | null;
    readonly displayTitle: string | null;
    readonly evidenceLevel: string | null;
    readonly metadataJson: string;
    readonly createdAt: string;
}

export interface StoredEventRow {
    readonly id: string;
    readonly task_id: string;
    readonly session_id: string | null;
    readonly kind: string;
    readonly lane: string;
    readonly title: string;
    readonly body: string | null;
    readonly subtype_key: string | null;
    readonly subtype_label: string | null;
    readonly subtype_group: string | null;
    readonly tool_family: string | null;
    readonly operation: string | null;
    readonly source_tool: string | null;
    readonly tool_name: string | null;
    readonly entity_type: string | null;
    readonly entity_name: string | null;
    readonly display_title: string | null;
    readonly evidence_level: string | null;
    readonly extras_json: string;
    readonly created_at: string;
}

interface EventFileRow {
    readonly event_id: string;
    readonly file_path: string;
    readonly source: string;
    readonly write_count: number;
}

interface EventRelationRow {
    readonly event_id: string;
    readonly source_event_id: string;
    readonly target_event_id: string;
    readonly edge_kind: "parent" | "source" | "related";
    readonly relation_type: string;
    readonly relation_label: string | null;
    readonly relation_explanation: string | null;
}

interface EventAsyncRow {
    readonly event_id: string;
    readonly async_task_id: string;
    readonly async_status: string | null;
    readonly async_agent: string | null;
    readonly async_category: string | null;
    readonly duration_ms: number | null;
}

interface EventTagRow {
    readonly event_id: string;
    readonly tag: string;
    readonly source: "metadata" | "classification" | "multiple";
}

interface TodoRow {
    readonly id: string;
    readonly task_id: string;
    readonly title: string;
    readonly state: string;
    readonly priority: string | null;
    readonly auto_reconciled: number;
    readonly last_event_id: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}

interface QuestionRow {
    readonly id: string;
    readonly task_id: string;
    readonly title: string;
    readonly phase: string;
    readonly sequence: number | null;
    readonly model_name: string | null;
    readonly model_provider: string | null;
    readonly last_event_id: string | null;
    readonly created_at: string;
    readonly updated_at: string;
}

interface TokenUsageRow {
    readonly event_id: string;
    readonly session_id: string | null;
    readonly task_id: string;
    readonly input_tokens: number;
    readonly output_tokens: number;
    readonly cache_read_tokens: number;
    readonly cache_create_tokens: number;
    readonly cost_usd: number | null;
    readonly duration_ms: number | null;
    readonly model: string | null;
    readonly prompt_id: string | null;
    readonly stop_reason: string | null;
    readonly occurred_at: string;
}

interface EventSupplements {
    readonly files: readonly EventFileRow[];
    readonly relations: readonly EventRelationRow[];
    readonly asyncRef?: EventAsyncRow;
    readonly tags: readonly EventTagRow[];
    readonly todo?: TodoRow;
    readonly question?: QuestionRow;
    readonly tokenUsage?: TokenUsageRow;
}

export function buildEventStorageValues(input: EventStorageInput): EventStorageValues {
    const metadata = input.metadata;
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (!DERIVED_METADATA_KEYS.has(key)) {
            extras[key] = value;
        }
    }

    return {
        id: input.id,
        taskId: input.taskId,
        sessionId: input.sessionId ?? null,
        kind: input.kind,
        lane: input.lane,
        title: input.title,
        body: input.body ?? null,
        subtypeKey: readString(metadata, "subtypeKey") ?? null,
        subtypeLabel: readString(metadata, "subtypeLabel") ?? null,
        subtypeGroup: readString(metadata, "subtypeGroup") ?? null,
        toolFamily: readString(metadata, "toolFamily") ?? null,
        operation: readString(metadata, "operation") ?? null,
        sourceTool: readString(metadata, "sourceTool") ?? null,
        toolName: readString(metadata, "toolName") ?? null,
        entityType: readString(metadata, "entityType") ?? null,
        entityName: readString(metadata, "entityName") ?? null,
        displayTitle: readString(metadata, "displayTitle") ?? null,
        evidenceLevel: readString(metadata, "evidenceLevel") ?? null,
        metadataJson: JSON.stringify(extras),
        createdAt: input.createdAt,
    };
}

export function syncEventDerivedTables(db: Database.Database, input: EventStorageInput): void {
    clearDerivedTables(db, input.id);
    insertEventFiles(db, input);
    insertEventRelations(db, input);
    insertEventAsyncRef(db, input);
    insertEventTags(db, input);
    upsertTodo(db, input);
    upsertQuestion(db, input);
    insertTokenUsage(db, input);
}

export function loadTimelineEventById(db: Database.Database, eventId: string): TimelineEvent | null {
    const row = db.prepare<{ eventId: string }, StoredEventRow>(`
      select *
      from timeline_events_view
      where id = @eventId
    `).get({ eventId });
    return row ? hydrateStoredEventRows(db, [row])[0] ?? null : null;
}

export function loadTimelineEventsForTask(db: Database.Database, taskId: string): readonly TimelineEvent[] {
    const rows = db.prepare<{ taskId: string }, StoredEventRow>(`
      select *
      from timeline_events_view
      where task_id = @taskId
      order by created_at asc
    `).all({ taskId });
    return hydrateStoredEventRows(db, rows);
}

export function hydrateStoredEventRows(
    db: Database.Database,
    rows: readonly StoredEventRow[],
): readonly TimelineEvent[] {
    if (rows.length === 0) {
        return [];
    }
    const supplements = loadEventSupplements(db, rows.map((row) => row.id));
    return rows.map((row) => mapStoredEventRow(row, supplements.get(row.id) ?? emptySupplements()));
}

function clearDerivedTables(db: Database.Database, eventId: string): void {
    for (const table of [
        "event_files",
        "event_relations",
        "event_async_refs",
        "event_tags",
        "event_token_usage",
    ]) {
        db.prepare(`delete from ${table} where event_id = @eventId`).run({ eventId });
    }
}

function insertEventFiles(db: Database.Database, input: EventStorageInput): void {
    const files = collectEventFiles(input.metadata);
    if (files.length === 0) {
        return;
    }
    const statement = db.prepare(`
      insert into event_files (event_id, file_path, source, write_count)
      values (@eventId, @filePath, @source, @writeCount)
    `);
    for (const file of files) {
        statement.run({
            eventId: input.id,
            filePath: file.path,
            source: file.source,
            writeCount: file.writeCount,
        });
    }
}

function insertEventRelations(db: Database.Database, input: EventStorageInput): void {
    const relationType = normalizeRelationType(readString(input.metadata, "relationType"));
    const relationLabel = readString(input.metadata, "relationLabel");
    const relationExplanation = readString(input.metadata, "relationExplanation");
    const relations: EventRelationRow[] = [];
    const parentEventId = readString(input.metadata, "parentEventId");
    if (parentEventId) {
        relations.push({
            event_id: input.id,
            source_event_id: parentEventId,
            target_event_id: input.id,
            edge_kind: "parent",
            relation_type: relationType,
            relation_label: relationLabel ?? null,
            relation_explanation: relationExplanation ?? null,
        });
    }
    const sourceEventId = readString(input.metadata, "sourceEventId");
    if (sourceEventId) {
        relations.push({
            event_id: input.id,
            source_event_id: sourceEventId,
            target_event_id: input.id,
            edge_kind: "source",
            relation_type: relationType,
            relation_label: relationLabel ?? null,
            relation_explanation: relationExplanation ?? null,
        });
    }
    for (const relatedEventId of readStringArray(input.metadata, "relatedEventIds")) {
        relations.push({
            event_id: input.id,
            source_event_id: input.id,
            target_event_id: relatedEventId,
            edge_kind: "related",
            relation_type: relationType,
            relation_label: relationLabel ?? null,
            relation_explanation: relationExplanation ?? null,
        });
    }
    if (relations.length === 0) {
        return;
    }
    const statement = db.prepare(`
      insert or ignore into event_relations (
        event_id, source_event_id, target_event_id, edge_kind, relation_type, relation_label, relation_explanation
      ) values (
        @event_id, @source_event_id, @target_event_id, @edge_kind, @relation_type, @relation_label, @relation_explanation
      )
    `);
    for (const relation of relations) {
        statement.run(relation);
    }
}

function insertEventAsyncRef(db: Database.Database, input: EventStorageInput): void {
    const asyncTaskId = readString(input.metadata, "asyncTaskId");
    if (!asyncTaskId) {
        return;
    }
    db.prepare(`
      insert into event_async_refs (
        event_id, async_task_id, async_status, async_agent, async_category, duration_ms
      ) values (
        @eventId, @asyncTaskId, @asyncStatus, @asyncAgent, @asyncCategory, @durationMs
      )
    `).run({
        eventId: input.id,
        asyncTaskId,
        asyncStatus: readString(input.metadata, "asyncStatus") ?? null,
        asyncAgent: readString(input.metadata, "asyncAgent") ?? readString(input.metadata, "agentName") ?? null,
        asyncCategory: readString(input.metadata, "asyncCategory") ?? null,
        durationMs: readNumber(input.metadata, "durationMs") ?? null,
    });
}

function insertEventTags(db: Database.Database, input: EventStorageInput): void {
    const tags = new Map<string, EventTagRow["source"]>();
    for (const tag of readTags(input.metadata["tags"])) {
        tags.set(tag, "metadata");
    }
    for (const tag of input.classification?.tags ?? []) {
        const trimmed = tag.trim();
        if (!trimmed) {
            continue;
        }
        const existing = tags.get(trimmed);
        tags.set(trimmed, existing && existing !== "classification" ? "multiple" : "classification");
    }
    if (tags.size === 0) {
        return;
    }
    const statement = db.prepare(`
      insert into event_tags (event_id, tag, source)
      values (@eventId, @tag, @source)
    `);
    for (const [tag, source] of tags.entries()) {
        statement.run({ eventId: input.id, tag, source });
    }
}

function upsertTodo(db: Database.Database, input: EventStorageInput): void {
    const todoId = readString(input.metadata, "todoId");
    if (!todoId) {
        return;
    }
    const state = normalizeTodoState(readString(input.metadata, "todoState"))
        ?? normalizeTodoState(readString(input.metadata, "status"))
        ?? "added";
    db.prepare(`
      insert into todos_current (
        id, task_id, title, state, priority, auto_reconciled, last_event_id, created_at, updated_at
      ) values (
        @id, @taskId, @title, @state, @priority, @autoReconciled, @eventId, @createdAt, @updatedAt
      )
      on conflict(id) do update set
        task_id = excluded.task_id,
        title = excluded.title,
        state = excluded.state,
        priority = excluded.priority,
        auto_reconciled = excluded.auto_reconciled,
        last_event_id = excluded.last_event_id,
        updated_at = excluded.updated_at
    `).run({
        id: todoId,
        taskId: input.taskId,
        title: input.title,
        state,
        priority: readString(input.metadata, "priority") ?? null,
        autoReconciled: readBoolean(input.metadata, "autoReconciled") ? 1 : 0,
        eventId: input.id,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
    });
}

function upsertQuestion(db: Database.Database, input: EventStorageInput): void {
    const questionId = readString(input.metadata, "questionId");
    if (!questionId) {
        return;
    }
    const phase = normalizeQuestionPhase(readString(input.metadata, "questionPhase")) ?? "asked";
    db.prepare(`
      insert into questions_current (
        id, task_id, title, phase, sequence, model_name, model_provider, last_event_id, created_at, updated_at
      ) values (
        @id, @taskId, @title, @phase, @sequence, @modelName, @modelProvider, @eventId, @createdAt, @updatedAt
      )
      on conflict(id) do update set
        task_id = excluded.task_id,
        title = excluded.title,
        phase = excluded.phase,
        sequence = excluded.sequence,
        model_name = excluded.model_name,
        model_provider = excluded.model_provider,
        last_event_id = excluded.last_event_id,
        updated_at = excluded.updated_at
    `).run({
        id: questionId,
        taskId: input.taskId,
        title: input.title,
        phase,
        sequence: readNumber(input.metadata, "sequence") ?? null,
        modelName: readString(input.metadata, "modelName") ?? readString(input.metadata, "model") ?? null,
        modelProvider: readString(input.metadata, "modelProvider") ?? null,
        eventId: input.id,
        createdAt: input.createdAt,
        updatedAt: input.createdAt,
    });
}

function insertTokenUsage(db: Database.Database, input: EventStorageInput): void {
    const tokenUsage = {
        inputTokens: readNumber(input.metadata, "inputTokens") ?? 0,
        outputTokens: readNumber(input.metadata, "outputTokens") ?? 0,
        cacheReadTokens: readNumber(input.metadata, "cacheReadTokens") ?? 0,
        cacheCreateTokens: readNumber(input.metadata, "cacheCreateTokens") ?? 0,
        costUsd: readNumber(input.metadata, "costUsd"),
        durationMs: readNumber(input.metadata, "durationMs"),
        model: readString(input.metadata, "model"),
        promptId: readString(input.metadata, "promptId"),
        stopReason: readString(input.metadata, "stopReason") ?? readString(input.metadata, "stop_reason"),
    };
    const hasUsage = tokenUsage.inputTokens > 0
        || tokenUsage.outputTokens > 0
        || tokenUsage.cacheReadTokens > 0
        || tokenUsage.cacheCreateTokens > 0
        || tokenUsage.costUsd != null
        || tokenUsage.durationMs != null
        || Boolean(tokenUsage.model)
        || Boolean(tokenUsage.promptId)
        || Boolean(tokenUsage.stopReason);
    if (!hasUsage) {
        return;
    }
    db.prepare(`
      insert into event_token_usage (
        event_id, session_id, task_id, input_tokens, output_tokens, cache_read_tokens,
        cache_create_tokens, cost_usd, duration_ms, model, prompt_id, stop_reason, occurred_at
      ) values (
        @eventId, @sessionId, @taskId, @inputTokens, @outputTokens, @cacheReadTokens,
        @cacheCreateTokens, @costUsd, @durationMs, @model, @promptId, @stopReason, @occurredAt
      )
    `).run({
        eventId: input.id,
        sessionId: input.sessionId ?? null,
        taskId: input.taskId,
        inputTokens: tokenUsage.inputTokens,
        outputTokens: tokenUsage.outputTokens,
        cacheReadTokens: tokenUsage.cacheReadTokens,
        cacheCreateTokens: tokenUsage.cacheCreateTokens,
        costUsd: tokenUsage.costUsd ?? null,
        durationMs: tokenUsage.durationMs ?? null,
        model: tokenUsage.model ?? null,
        promptId: tokenUsage.promptId ?? null,
        stopReason: tokenUsage.stopReason ?? null,
        occurredAt: input.createdAt,
    });
}

function loadEventSupplements(db: Database.Database, eventIds: readonly string[]): Map<string, EventSupplements> {
    const placeholders = eventIds.map(() => "?").join(", ");
    const map = new Map<string, MutableEventSupplements>();
    for (const eventId of eventIds) {
        map.set(eventId, mutableSupplements());
    }

    for (const file of db.prepare<string[], EventFileRow>(`
      select *
      from event_files
      where event_id in (${placeholders})
      order by event_id asc, file_path asc
    `).all(...eventIds)) {
        map.get(file.event_id)?.files.push(file);
    }
    for (const relation of db.prepare<string[], EventRelationRow>(`
      select *
      from event_relations
      where event_id in (${placeholders})
      order by event_id asc, edge_kind asc, target_event_id asc
    `).all(...eventIds)) {
        map.get(relation.event_id)?.relations.push(relation);
    }
    for (const asyncRef of db.prepare<string[], EventAsyncRow>(`
      select *
      from event_async_refs
      where event_id in (${placeholders})
    `).all(...eventIds)) {
        const supplements = map.get(asyncRef.event_id);
        if (supplements) supplements.asyncRef = asyncRef;
    }
    for (const tag of db.prepare<string[], EventTagRow>(`
      select *
      from event_tags
      where event_id in (${placeholders})
      order by event_id asc, tag asc
    `).all(...eventIds)) {
        map.get(tag.event_id)?.tags.push(tag);
    }
    for (const todo of db.prepare<string[], TodoRow>(`
      select *
      from todos_current
      where last_event_id in (${placeholders})
    `).all(...eventIds)) {
        const supplements = todo.last_event_id ? map.get(todo.last_event_id) : undefined;
        if (supplements) supplements.todo = todo;
    }
    for (const question of db.prepare<string[], QuestionRow>(`
      select *
      from questions_current
      where last_event_id in (${placeholders})
    `).all(...eventIds)) {
        const supplements = question.last_event_id ? map.get(question.last_event_id) : undefined;
        if (supplements) supplements.question = question;
    }
    for (const tokenUsage of db.prepare<string[], TokenUsageRow>(`
      select *
      from event_token_usage
      where event_id in (${placeholders})
    `).all(...eventIds)) {
        const supplements = map.get(tokenUsage.event_id);
        if (supplements) supplements.tokenUsage = tokenUsage;
    }

    return map;
}

interface MutableEventSupplements {
    files: EventFileRow[];
    relations: EventRelationRow[];
    asyncRef?: EventAsyncRow;
    tags: EventTagRow[];
    todo?: TodoRow;
    question?: QuestionRow;
    tokenUsage?: TokenUsageRow;
}

function mutableSupplements(): MutableEventSupplements {
    return {
        files: [],
        relations: [],
        tags: [],
    };
}

function emptySupplements(): EventSupplements {
    return {
        files: [],
        relations: [],
        tags: [],
    };
}

function mapStoredEventRow(row: StoredEventRow, supplements: EventSupplements): TimelineEvent {
    const metadata = parseJsonField<Record<string, unknown>>(row.extras_json || "{}");
    addString(metadata, "subtypeKey", row.subtype_key);
    addString(metadata, "subtypeLabel", row.subtype_label);
    addString(metadata, "subtypeGroup", row.subtype_group);
    addString(metadata, "toolFamily", row.tool_family);
    addString(metadata, "operation", row.operation);
    addString(metadata, "sourceTool", row.source_tool);
    addString(metadata, "toolName", row.tool_name);
    addString(metadata, "entityType", row.entity_type);
    addString(metadata, "entityName", row.entity_name);
    addString(metadata, "displayTitle", row.display_title);
    addString(metadata, "evidenceLevel", row.evidence_level);
    applyFileMetadata(metadata, supplements.files);
    applyRelationMetadata(metadata, row.id, supplements.relations);
    applyAsyncMetadata(metadata, supplements.asyncRef);
    applyTagMetadata(metadata, supplements.tags);
    applyTodoMetadata(metadata, supplements.todo);
    applyQuestionMetadata(metadata, supplements.question);
    applyTokenUsageMetadata(metadata, supplements.tokenUsage);

    const lane = normalizeLane(row.lane as TimelineLane);
    const classification: EventClassification = {
        lane,
        tags: supplements.tags.map((tag) => tag.tag),
        matches: [],
    };
    return {
        id: row.id,
        taskId: row.task_id,
        kind: row.kind as MonitoringEventKind,
        lane,
        title: row.title,
        metadata,
        classification,
        createdAt: row.created_at,
        ...(row.session_id ? { sessionId: row.session_id } : {}),
        ...(row.body ? { body: row.body } : {}),
    };
}

interface EventFileValue {
    readonly path: string;
    readonly source: "metadata" | "command_analysis" | "runtime_relpath" | "multiple";
    readonly writeCount: number;
}

function collectEventFiles(metadata: Record<string, unknown>): readonly EventFileValue[] {
    const files = new Map<string, EventFileValue>();
    const writeCount = Math.max(0, Math.trunc(readNumber(metadata, "writeCount") ?? 0));
    const addFile = (path: string | undefined, source: EventFileValue["source"], count = 0): void => {
        const normalized = path?.trim();
        if (!normalized) {
            return;
        }
        const existing = files.get(normalized);
        if (!existing) {
            files.set(normalized, { path: normalized, source, writeCount: count });
            return;
        }
        files.set(normalized, {
            path: normalized,
            source: existing.source === source ? source : "multiple",
            writeCount: Math.max(existing.writeCount, count),
        });
    };
    addFile(readString(metadata, "filePath"), "metadata", writeCount);
    for (const filePath of readStringArray(metadata, "filePaths")) {
        addFile(filePath, "metadata", writeCount);
    }
    addFile(readString(metadata, "relPath"), "runtime_relpath", writeCount);
    for (const filePath of extractCommandAnalysisPaths(metadata["commandAnalysis"])) {
        addFile(filePath, "command_analysis", 0);
    }
    return [...files.values()];
}

function extractCommandAnalysisPaths(value: unknown): readonly string[] {
    if (!value || typeof value !== "object") {
        return [];
    }
    const steps = (value as { readonly steps?: unknown }).steps;
    if (!Array.isArray(steps)) {
        return [];
    }
    const paths: string[] = [];
    for (const step of flattenCommandSteps(steps)) {
        const targets = Array.isArray(step.targets) ? step.targets : [];
        for (const targetValue of targets) {
            if (!targetValue || typeof targetValue !== "object") continue;
            const target = targetValue as { readonly type?: unknown; readonly value?: unknown };
            if (target.type !== "file" && target.type !== "directory" && target.type !== "path") continue;
            if (typeof target.value === "string" && target.value.trim()) {
                paths.push(target.value);
            }
        }
    }
    return paths;
}

interface CommandStepLike {
    readonly targets?: unknown;
    readonly pipeline?: unknown;
}

function flattenCommandSteps(values: readonly unknown[]): readonly CommandStepLike[] {
    const flattened: CommandStepLike[] = [];
    for (const value of values) {
        if (!value || typeof value !== "object") continue;
        const step = value as CommandStepLike;
        flattened.push(step);
        if (Array.isArray(step.pipeline)) {
            flattened.push(...flattenCommandSteps(step.pipeline));
        }
    }
    return flattened;
}

function applyFileMetadata(metadata: Record<string, unknown>, files: readonly EventFileRow[]): void {
    if (files.length === 0) {
        return;
    }
    const filePaths = [...new Set(files.map((file) => file.file_path))];
    metadata.filePaths = filePaths;
    if (!metadata.filePath && filePaths[0]) {
        metadata.filePath = filePaths[0];
    }
    const relPath = files.find((file) => file.source === "runtime_relpath" || file.source === "multiple")?.file_path;
    if (relPath && !metadata.relPath) {
        metadata.relPath = relPath;
    }
    const writeCount = Math.max(...files.map((file) => file.write_count));
    if (writeCount > 0 && typeof metadata.writeCount !== "number") {
        metadata.writeCount = writeCount;
    }
}

function applyRelationMetadata(metadata: Record<string, unknown>, eventId: string, relations: readonly EventRelationRow[]): void {
    const parent = relations.find((relation) => relation.edge_kind === "parent");
    if (parent) {
        metadata.parentEventId = parent.source_event_id;
    }
    const source = relations.find((relation) => relation.edge_kind === "source");
    if (source) {
        metadata.sourceEventId = source.source_event_id;
    }
    const relatedEventIds = relations
        .filter((relation) => relation.edge_kind === "related" && relation.source_event_id === eventId)
        .map((relation) => relation.target_event_id);
    if (relatedEventIds.length > 0) {
        metadata.relatedEventIds = [...new Set(relatedEventIds)];
    }
    const semanticRelation = parent ?? source ?? relations[0];
    if (semanticRelation) {
        metadata.relationType = semanticRelation.relation_type;
        addString(metadata, "relationLabel", semanticRelation.relation_label);
        addString(metadata, "relationExplanation", semanticRelation.relation_explanation);
    }
}

function applyAsyncMetadata(metadata: Record<string, unknown>, asyncRef: EventAsyncRow | undefined): void {
    if (!asyncRef) return;
    metadata.asyncTaskId = asyncRef.async_task_id;
    addString(metadata, "asyncStatus", asyncRef.async_status);
    addString(metadata, "asyncAgent", asyncRef.async_agent);
    addString(metadata, "asyncCategory", asyncRef.async_category);
    if (asyncRef.duration_ms != null) {
        metadata.durationMs = asyncRef.duration_ms;
    }
}

function applyTagMetadata(metadata: Record<string, unknown>, tags: readonly EventTagRow[]): void {
    if (tags.length > 0) {
        metadata.tags = tags.map((tag) => tag.tag);
    }
}

function applyTodoMetadata(metadata: Record<string, unknown>, todo: TodoRow | undefined): void {
    if (!todo) return;
    metadata.todoId = todo.id;
    metadata.todoState = todo.state;
    metadata.status = todo.state;
    addString(metadata, "priority", todo.priority);
    if (todo.auto_reconciled === 1) {
        metadata.autoReconciled = true;
    }
}

function applyQuestionMetadata(metadata: Record<string, unknown>, question: QuestionRow | undefined): void {
    if (!question) return;
    metadata.questionId = question.id;
    metadata.questionPhase = question.phase;
    if (question.sequence != null) {
        metadata.sequence = question.sequence;
    }
    addString(metadata, "modelName", question.model_name);
    addString(metadata, "modelProvider", question.model_provider);
}

function applyTokenUsageMetadata(metadata: Record<string, unknown>, tokenUsage: TokenUsageRow | undefined): void {
    if (!tokenUsage) return;
    metadata.inputTokens = tokenUsage.input_tokens;
    metadata.outputTokens = tokenUsage.output_tokens;
    metadata.cacheReadTokens = tokenUsage.cache_read_tokens;
    metadata.cacheCreateTokens = tokenUsage.cache_create_tokens;
    if (tokenUsage.cost_usd != null) metadata.costUsd = tokenUsage.cost_usd;
    if (tokenUsage.duration_ms != null) metadata.durationMs = tokenUsage.duration_ms;
    addString(metadata, "model", tokenUsage.model);
    addString(metadata, "promptId", tokenUsage.prompt_id);
    addString(metadata, "stopReason", tokenUsage.stop_reason);
}

function normalizeRelationType(value: string | undefined): string {
    return isEventRelationType(value) ? value : "relates_to";
}

function normalizeTodoState(value: string | undefined): string | undefined {
    return value && TODO_STATE_SET.has(value) ? value : undefined;
}

function normalizeQuestionPhase(value: string | undefined): string | undefined {
    return value && QUESTION_PHASE_SET.has(value) ? value : undefined;
}

function readString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = metadata?.[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

function readStringArray(metadata: Record<string, unknown> | undefined, key: string): readonly string[] {
    const value = metadata?.[key];
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function readTags(value: unknown): readonly string[] {
    if (typeof value === "string") {
        return value.trim() ? [value.trim()] : [];
    }
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function readNumber(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
    const value = metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(metadata: Record<string, unknown> | undefined, key: string): boolean | undefined {
    const value = metadata?.[key];
    return typeof value === "boolean" ? value : undefined;
}

function addString(metadata: Record<string, unknown>, key: string, value: string | null | undefined): void {
    if (value) {
        metadata[key] = value;
    }
}

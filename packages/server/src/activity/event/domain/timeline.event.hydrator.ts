import type { TimelineEvent } from "~activity/event/domain/model/timeline.event.model.js";
import type { MonitoringEventKind, TimelineLane } from "~activity/event/domain/common/type/event.kind.type.js";
import { normalizeLane } from "~activity/event/domain/event.lane.js";
import { parseJsonField } from "./event.json.js";
import type { EventFileEntity } from "./event.file.entity.js";
import type { EventRelationEntity } from "./event.relation.entity.js";
import type { EventAsyncRefEntity } from "./event.async.ref.entity.js";
import type { EventTagEntity } from "./event.tag.entity.js";
import type { TodoCurrentEntity } from "./todo.current.entity.js";
import type { QuestionCurrentEntity } from "./question.current.entity.js";
import type { EventTokenUsageEntity } from "./event.token.usage.entity.js";
import type { TimelineEventEntity } from "./timeline.event.entity.js";

export interface HydrationSupplements {
    readonly files: readonly EventFileEntity[];
    readonly relations: readonly EventRelationEntity[];
    readonly asyncRef?: EventAsyncRefEntity;
    readonly tags: readonly EventTagEntity[];
    readonly todo?: TodoCurrentEntity;
    readonly question?: QuestionCurrentEntity;
    readonly tokenUsage?: EventTokenUsageEntity;
}

export function emptySupplements(): HydrationSupplements {
    return { files: [], relations: [], tags: [] };
}

/** Pure: combine main row with derived-table supplements into a TimelineEvent. */
export function hydrateTimelineEvent(row: TimelineEventEntity, supplements: HydrationSupplements): TimelineEvent {
    const metadata = parseJsonField<Record<string, unknown>>(row.extrasJson || "{}");
    addString(metadata, "subtypeKey", row.subtypeKey);
    addString(metadata, "subtypeLabel", row.subtypeLabel);
    addString(metadata, "subtypeGroup", row.subtypeGroup);
    addString(metadata, "toolFamily", row.toolFamily);
    addString(metadata, "operation", row.operation);
    addString(metadata, "sourceTool", row.sourceTool);
    addString(metadata, "toolName", row.toolName);
    addString(metadata, "entityType", row.entityType);
    addString(metadata, "entityName", row.entityName);
    addString(metadata, "displayTitle", row.displayTitle);
    addString(metadata, "evidenceLevel", row.evidenceLevel);
    applyFileMetadata(metadata, supplements.files);
    applyRelationMetadata(metadata, row.id, supplements.relations);
    applyAsyncMetadata(metadata, supplements.asyncRef);
    applyTagMetadata(metadata, supplements.tags);
    applyTodoMetadata(metadata, supplements.todo);
    applyQuestionMetadata(metadata, supplements.question);
    applyTokenUsageMetadata(metadata, supplements.tokenUsage);

    const lane = normalizeLane(row.lane);
    return {
        id: row.id,
        taskId: row.taskId,
        kind: row.kind as MonitoringEventKind,
        lane,
        title: row.title,
        metadata,
        classification: {
            lane,
            tags: supplements.tags.map((tag) => tag.tag),
            matches: [],
        },
        createdAt: row.createdAt,
        ...(row.sessionId ? { sessionId: row.sessionId } : {}),
        ...(row.body ? { body: row.body } : {}),
    };
}

export function indexSupplementsByEventId(
    eventIds: readonly string[],
    files: readonly EventFileEntity[],
    relations: readonly EventRelationEntity[],
    asyncRefs: readonly EventAsyncRefEntity[],
    tags: readonly EventTagEntity[],
    todos: readonly TodoCurrentEntity[],
    questions: readonly QuestionCurrentEntity[],
    tokenUsages: readonly EventTokenUsageEntity[],
): Map<string, HydrationSupplements> {
    const map = new Map<string, MutableSupplements>();
    for (const id of eventIds) map.set(id, mutable());
    for (const f of files) map.get(f.eventId)?.files.push(f);
    for (const r of relations) map.get(r.eventId)?.relations.push(r);
    for (const a of asyncRefs) {
        const s = map.get(a.eventId);
        if (s) s.asyncRef = a;
    }
    for (const t of tags) map.get(t.eventId)?.tags.push(t);
    for (const todo of todos) {
        const s = todo.lastEventId ? map.get(todo.lastEventId) : undefined;
        if (s) s.todo = todo;
    }
    for (const q of questions) {
        const s = q.lastEventId ? map.get(q.lastEventId) : undefined;
        if (s) s.question = q;
    }
    for (const u of tokenUsages) {
        const s = map.get(u.eventId);
        if (s) s.tokenUsage = u;
    }
    return map as unknown as Map<string, HydrationSupplements>;
}

interface MutableSupplements {
    files: EventFileEntity[];
    relations: EventRelationEntity[];
    asyncRef?: EventAsyncRefEntity;
    tags: EventTagEntity[];
    todo?: TodoCurrentEntity;
    question?: QuestionCurrentEntity;
    tokenUsage?: EventTokenUsageEntity;
}

function mutable(): MutableSupplements {
    return { files: [], relations: [], tags: [] };
}

function applyFileMetadata(metadata: Record<string, unknown>, files: readonly EventFileEntity[]): void {
    if (files.length === 0) return;
    const filePaths = [...new Set(files.map((file) => file.filePath))];
    metadata.filePaths = filePaths;
    if (!metadata.filePath && filePaths[0]) metadata.filePath = filePaths[0];
    const relPath = files.find((file) => file.source === "runtime_relpath" || file.source === "multiple")?.filePath;
    if (relPath && !metadata.relPath) metadata.relPath = relPath;
    const writeCount = Math.max(...files.map((file) => file.writeCount));
    if (writeCount > 0 && typeof metadata.writeCount !== "number") metadata.writeCount = writeCount;
}

function applyRelationMetadata(metadata: Record<string, unknown>, eventId: string, relations: readonly EventRelationEntity[]): void {
    const parent = relations.find((relation) => relation.edgeKind === "parent");
    if (parent) metadata.parentEventId = parent.sourceEventId;
    const source = relations.find((relation) => relation.edgeKind === "source");
    if (source) metadata.sourceEventId = source.sourceEventId;
    const relatedEventIds = relations
        .filter((relation) => relation.edgeKind === "related" && relation.sourceEventId === eventId)
        .map((relation) => relation.targetEventId);
    if (relatedEventIds.length > 0) metadata.relatedEventIds = [...new Set(relatedEventIds)];
    const semanticRelation = parent ?? source ?? relations[0];
    if (semanticRelation) {
        metadata.relationType = semanticRelation.relationType;
        addString(metadata, "relationLabel", semanticRelation.relationLabel);
        addString(metadata, "relationExplanation", semanticRelation.relationExplanation);
    }
}

function applyAsyncMetadata(metadata: Record<string, unknown>, asyncRef: EventAsyncRefEntity | undefined): void {
    if (!asyncRef) return;
    metadata.asyncTaskId = asyncRef.asyncTaskId;
    addString(metadata, "asyncStatus", asyncRef.asyncStatus);
    addString(metadata, "asyncAgent", asyncRef.asyncAgent);
    addString(metadata, "asyncCategory", asyncRef.asyncCategory);
    if (asyncRef.durationMs != null) metadata.durationMs = asyncRef.durationMs;
}

function applyTagMetadata(metadata: Record<string, unknown>, tags: readonly EventTagEntity[]): void {
    if (tags.length > 0) metadata.tags = tags.map((tag) => tag.tag);
}

function applyTodoMetadata(metadata: Record<string, unknown>, todo: TodoCurrentEntity | undefined): void {
    if (!todo) return;
    metadata.todoId = todo.id;
    metadata.todoState = todo.state;
    metadata.status = todo.state;
    addString(metadata, "priority", todo.priority);
    if (todo.autoReconciled === 1) metadata.autoReconciled = true;
}

function applyQuestionMetadata(metadata: Record<string, unknown>, question: QuestionCurrentEntity | undefined): void {
    if (!question) return;
    metadata.questionId = question.id;
    metadata.questionPhase = question.phase;
    if (question.sequence != null) metadata.sequence = question.sequence;
    addString(metadata, "modelName", question.modelName);
    addString(metadata, "modelProvider", question.modelProvider);
}

function applyTokenUsageMetadata(metadata: Record<string, unknown>, tokenUsage: EventTokenUsageEntity | undefined): void {
    if (!tokenUsage) return;
    metadata.inputTokens = tokenUsage.inputTokens;
    metadata.outputTokens = tokenUsage.outputTokens;
    metadata.cacheReadTokens = tokenUsage.cacheReadTokens;
    metadata.cacheCreateTokens = tokenUsage.cacheCreateTokens;
    if (tokenUsage.costUsd != null) metadata.costUsd = tokenUsage.costUsd;
    if (tokenUsage.durationMs != null) metadata.durationMs = tokenUsage.durationMs;
    addString(metadata, "model", tokenUsage.model);
    addString(metadata, "promptId", tokenUsage.promptId);
    addString(metadata, "stopReason", tokenUsage.stopReason);
}

function addString(metadata: Record<string, unknown>, key: string, value: string | null | undefined): void {
    if (value) metadata[key] = value;
}

/** Type alias for use by callers. */
export type HydratedTimelineEvent = TimelineEvent;

/** Cast helper — convert TimelineLane to plain string. */
function hydratedLane(event: HydratedTimelineEvent): TimelineLane {
    return event.lane;
}

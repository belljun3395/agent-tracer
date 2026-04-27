import type { TimelineEventInsertRequest } from "../application/outbound/event.persistence.port.js";
import { TimelineEventEntity } from "./timeline.event.entity.js";
import { EventFileEntity } from "./event.file.entity.js";
import { EventRelationEntity } from "./event.relation.entity.js";
import { EventAsyncRefEntity } from "./event.async.ref.entity.js";
import { EventTagEntity } from "./event.tag.entity.js";
import { TodoCurrentEntity } from "./todo.current.entity.js";
import { QuestionCurrentEntity } from "./question.current.entity.js";
import { EventTokenUsageEntity } from "./event.token.usage.entity.js";
import {
    DERIVED_METADATA_KEYS,
    normalizeQuestionPhase,
    normalizeRelationType,
    normalizeTodoState,
    readBoolean,
    readNumber,
    readString,
    readStringArray,
    readTags,
} from "./timeline.event.metadata.js";

interface EventFileValue {
    readonly path: string;
    readonly source: "metadata" | "command_analysis" | "runtime_relpath" | "multiple";
    readonly writeCount: number;
}

export interface DerivedTableInserts {
    readonly files: readonly EventFileEntity[];
    readonly relations: readonly EventRelationEntity[];
    readonly asyncRef?: EventAsyncRefEntity;
    readonly tags: readonly EventTagEntity[];
    readonly todo?: TodoCurrentEntity;
    readonly question?: QuestionCurrentEntity;
    readonly tokenUsage?: EventTokenUsageEntity;
}

export function buildTimelineEventEntity(input: TimelineEventInsertRequest): TimelineEventEntity {
    const metadata = input.metadata;
    const extras: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (!DERIVED_METADATA_KEYS.has(key)) extras[key] = value;
    }
    const entity = new TimelineEventEntity();
    entity.id = input.id;
    entity.taskId = input.taskId;
    entity.sessionId = input.sessionId ?? null;
    entity.kind = input.kind;
    entity.lane = input.lane;
    entity.title = input.title;
    entity.body = input.body ?? null;
    entity.subtypeKey = readString(metadata, "subtypeKey") ?? null;
    entity.subtypeLabel = readString(metadata, "subtypeLabel") ?? null;
    entity.subtypeGroup = readString(metadata, "subtypeGroup") ?? null;
    entity.toolFamily = readString(metadata, "toolFamily") ?? null;
    entity.operation = readString(metadata, "operation") ?? null;
    entity.sourceTool = readString(metadata, "sourceTool") ?? null;
    entity.toolName = readString(metadata, "toolName") ?? null;
    entity.entityType = readString(metadata, "entityType") ?? null;
    entity.entityName = readString(metadata, "entityName") ?? null;
    entity.displayTitle = readString(metadata, "displayTitle") ?? null;
    entity.evidenceLevel = readString(metadata, "evidenceLevel") ?? null;
    entity.extrasJson = JSON.stringify(extras);
    entity.createdAt = input.createdAt;
    return entity;
}

export function buildDerivedTableInserts(input: TimelineEventInsertRequest): DerivedTableInserts {
    const asyncRef = collectAsyncRef(input);
    const todo = collectTodoRow(input);
    const question = collectQuestionRow(input);
    const tokenUsage = collectTokenUsageRow(input);
    return {
        files: collectFileRows(input),
        relations: collectRelationRows(input),
        tags: collectTagRows(input),
        ...(asyncRef ? { asyncRef } : {}),
        ...(todo ? { todo } : {}),
        ...(question ? { question } : {}),
        ...(tokenUsage ? { tokenUsage } : {}),
    };
}

function collectFileRows(input: TimelineEventInsertRequest): readonly EventFileEntity[] {
    const values = collectEventFiles(input.metadata);
    return values.map((file) => {
        const row = new EventFileEntity();
        row.eventId = input.id;
        row.filePath = file.path;
        row.source = file.source;
        row.writeCount = file.writeCount;
        return row;
    });
}

function collectRelationRows(input: TimelineEventInsertRequest): readonly EventRelationEntity[] {
    const relationType = normalizeRelationType(readString(input.metadata, "relationType"));
    const relationLabel = readString(input.metadata, "relationLabel") ?? null;
    const relationExplanation = readString(input.metadata, "relationExplanation") ?? null;
    const rows: EventRelationEntity[] = [];
    const parentEventId = readString(input.metadata, "parentEventId");
    if (parentEventId) {
        rows.push(makeRelation(input.id, parentEventId, input.id, "parent", relationType, relationLabel, relationExplanation));
    }
    const sourceEventId = readString(input.metadata, "sourceEventId");
    if (sourceEventId) {
        rows.push(makeRelation(input.id, sourceEventId, input.id, "source", relationType, relationLabel, relationExplanation));
    }
    for (const relatedEventId of readStringArray(input.metadata, "relatedEventIds")) {
        rows.push(makeRelation(input.id, input.id, relatedEventId, "related", relationType, relationLabel, relationExplanation));
    }
    return rows;
}

function makeRelation(
    eventId: string,
    sourceEventId: string,
    targetEventId: string,
    edgeKind: "parent" | "source" | "related",
    relationType: string,
    relationLabel: string | null,
    relationExplanation: string | null,
): EventRelationEntity {
    const row = new EventRelationEntity();
    row.eventId = eventId;
    row.sourceEventId = sourceEventId;
    row.targetEventId = targetEventId;
    row.edgeKind = edgeKind;
    row.relationType = relationType;
    row.relationLabel = relationLabel;
    row.relationExplanation = relationExplanation;
    return row;
}

function collectAsyncRef(input: TimelineEventInsertRequest): EventAsyncRefEntity | undefined {
    const asyncTaskId = readString(input.metadata, "asyncTaskId");
    if (!asyncTaskId) return undefined;
    const row = new EventAsyncRefEntity();
    row.eventId = input.id;
    row.asyncTaskId = asyncTaskId;
    row.asyncStatus = readString(input.metadata, "asyncStatus") ?? null;
    row.asyncAgent = readString(input.metadata, "asyncAgent") ?? readString(input.metadata, "agentName") ?? null;
    row.asyncCategory = readString(input.metadata, "asyncCategory") ?? null;
    row.durationMs = readNumber(input.metadata, "durationMs") ?? null;
    return row;
}

function collectTagRows(input: TimelineEventInsertRequest): readonly EventTagEntity[] {
    const tags = new Map<string, EventTagEntity["source"]>();
    for (const tag of readTags(input.metadata["tags"])) {
        tags.set(tag, "metadata");
    }
    for (const tag of input.classification.tags) {
        const trimmed = tag.trim();
        if (!trimmed) continue;
        const existing = tags.get(trimmed);
        tags.set(trimmed, existing && existing !== "classification" ? "multiple" : "classification");
    }
    return [...tags.entries()].map(([tag, source]) => {
        const row = new EventTagEntity();
        row.eventId = input.id;
        row.tag = tag;
        row.source = source;
        return row;
    });
}

function collectTodoRow(input: TimelineEventInsertRequest): TodoCurrentEntity | undefined {
    const todoId = readString(input.metadata, "todoId");
    if (!todoId) return undefined;
    const state = normalizeTodoState(readString(input.metadata, "todoState"))
        ?? normalizeTodoState(readString(input.metadata, "status"))
        ?? "added";
    const row = new TodoCurrentEntity();
    row.id = todoId;
    row.taskId = input.taskId;
    row.title = input.title;
    row.state = state;
    row.priority = readString(input.metadata, "priority") ?? null;
    row.autoReconciled = readBoolean(input.metadata, "autoReconciled") ? 1 : 0;
    row.lastEventId = input.id;
    row.createdAt = input.createdAt;
    row.updatedAt = input.createdAt;
    return row;
}

function collectQuestionRow(input: TimelineEventInsertRequest): QuestionCurrentEntity | undefined {
    const questionId = readString(input.metadata, "questionId");
    if (!questionId) return undefined;
    const phase = normalizeQuestionPhase(readString(input.metadata, "questionPhase")) ?? "asked";
    const row = new QuestionCurrentEntity();
    row.id = questionId;
    row.taskId = input.taskId;
    row.title = input.title;
    row.phase = phase;
    row.sequence = readNumber(input.metadata, "sequence") ?? null;
    row.modelName = readString(input.metadata, "modelName") ?? readString(input.metadata, "model") ?? null;
    row.modelProvider = readString(input.metadata, "modelProvider") ?? null;
    row.lastEventId = input.id;
    row.createdAt = input.createdAt;
    row.updatedAt = input.createdAt;
    return row;
}

function collectTokenUsageRow(input: TimelineEventInsertRequest): EventTokenUsageEntity | undefined {
    const inputTokens = readNumber(input.metadata, "inputTokens") ?? 0;
    const outputTokens = readNumber(input.metadata, "outputTokens") ?? 0;
    const cacheReadTokens = readNumber(input.metadata, "cacheReadTokens") ?? 0;
    const cacheCreateTokens = readNumber(input.metadata, "cacheCreateTokens") ?? 0;
    const costUsd = readNumber(input.metadata, "costUsd");
    const durationMs = readNumber(input.metadata, "durationMs");
    const model = readString(input.metadata, "model");
    const promptId = readString(input.metadata, "promptId");
    const stopReason = readString(input.metadata, "stopReason") ?? readString(input.metadata, "stop_reason");
    const hasUsage = inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0 || cacheCreateTokens > 0
        || costUsd != null || durationMs != null || Boolean(model) || Boolean(promptId) || Boolean(stopReason);
    if (!hasUsage) return undefined;
    const row = new EventTokenUsageEntity();
    row.eventId = input.id;
    row.sessionId = input.sessionId ?? null;
    row.taskId = input.taskId;
    row.inputTokens = inputTokens;
    row.outputTokens = outputTokens;
    row.cacheReadTokens = cacheReadTokens;
    row.cacheCreateTokens = cacheCreateTokens;
    row.costUsd = costUsd ?? null;
    row.durationMs = durationMs ?? null;
    row.model = model ?? null;
    row.promptId = promptId ?? null;
    row.stopReason = stopReason ?? null;
    row.occurredAt = input.createdAt;
    return row;
}

function collectEventFiles(metadata: Record<string, unknown>): readonly EventFileValue[] {
    const files = new Map<string, EventFileValue>();
    const writeCount = Math.max(0, Math.trunc(readNumber(metadata, "writeCount") ?? 0));
    const addFile = (path: string | undefined, source: EventFileValue["source"], count = 0): void => {
        const normalized = path?.trim();
        if (!normalized) return;
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
    if (!value || typeof value !== "object") return [];
    const steps = (value as { readonly steps?: unknown }).steps;
    if (!Array.isArray(steps)) return [];
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

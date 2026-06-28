import type { TimelineEventInsertRequest } from "../application/outbound/event.persistence.port.js";
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
} from "./timeline.event.metadata.policy.js";

// 메인 행에 별도 컬럼으로 저장되는 분류/도구 식별자.
export interface TimelineEventColumns {
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
}

const COLUMN_KEYS = [
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

type FileSource = "metadata" | "command_analysis" | "runtime_relpath" | "multiple";
interface EventFileValue {
    readonly path: string;
    readonly source: FileSource;
    readonly writeCount: number;
}

// 원시 metadata를 한 번 정규화해 저장 표현(blob·tags·인덱스 컬럼)을 만드는 값 객체.
export class EventMetadata {
    private constructor(
        readonly metadata: Record<string, unknown>,
        readonly tags: readonly string[],
        readonly columns: TimelineEventColumns,
    ) {}

    static normalize(input: TimelineEventInsertRequest): EventMetadata {
        const raw = input.metadata;

        // DERIVED 키는 정규화해 다시 채우므로 우선 제외하고 나머지를 보존한다.
        const metadata: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(raw)) {
            if (!DERIVED_METADATA_KEYS.has(key)) metadata[key] = value;
        }

        const columns = extractColumns(raw);
        for (const key of COLUMN_KEYS) {
            addString(metadata, key, columns[key]);
        }

        // durationMs처럼 뒤 facet이 앞 값을 덮을 수 있어 적용 순서를 고정한다.
        applyFiles(metadata, raw);
        applyRelations(metadata, raw);
        applyAsync(metadata, raw);
        const tags = applyTags(metadata, raw, input.classification.tags);
        applyTodo(metadata, raw);
        applyQuestion(metadata, raw);
        applyTokenUsage(metadata, raw);

        return new EventMetadata(metadata, tags, columns);
    }
}

function extractColumns(raw: Record<string, unknown>): TimelineEventColumns {
    return {
        subtypeKey: readString(raw, "subtypeKey") ?? null,
        subtypeLabel: readString(raw, "subtypeLabel") ?? null,
        subtypeGroup: readString(raw, "subtypeGroup") ?? null,
        toolFamily: readString(raw, "toolFamily") ?? null,
        operation: readString(raw, "operation") ?? null,
        sourceTool: readString(raw, "sourceTool") ?? null,
        toolName: readString(raw, "toolName") ?? null,
        entityType: readString(raw, "entityType") ?? null,
        entityName: readString(raw, "entityName") ?? null,
        displayTitle: readString(raw, "displayTitle") ?? null,
        evidenceLevel: readString(raw, "evidenceLevel") ?? null,
    };
}

function applyFiles(metadata: Record<string, unknown>, raw: Record<string, unknown>): void {
    const files = collectEventFiles(raw);
    if (files.length === 0) return;
    const filePaths = [...new Set(files.map((file) => file.path))];
    metadata.filePaths = filePaths;
    if (!metadata.filePath && filePaths[0]) metadata.filePath = filePaths[0];
    const relPath = files.find((file) => file.source === "runtime_relpath" || file.source === "multiple")?.path;
    if (relPath && !metadata.relPath) metadata.relPath = relPath;
    const writeCount = Math.max(...files.map((file) => file.writeCount));
    if (writeCount > 0 && typeof metadata.writeCount !== "number") metadata.writeCount = writeCount;
}

function collectEventFiles(metadata: Record<string, unknown>): readonly EventFileValue[] {
    const files = new Map<string, EventFileValue>();
    const writeCount = Math.max(0, Math.trunc(readNumber(metadata, "writeCount") ?? 0));
    const addFile = (path: string | undefined, source: FileSource, count = 0): void => {
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

function applyRelations(metadata: Record<string, unknown>, raw: Record<string, unknown>): void {
    const parentEventId = readString(raw, "parentEventId");
    const sourceEventId = readString(raw, "sourceEventId");
    const relatedEventIds = readStringArray(raw, "relatedEventIds");
    if (parentEventId) metadata.parentEventId = parentEventId;
    if (sourceEventId) metadata.sourceEventId = sourceEventId;
    if (relatedEventIds.length > 0) metadata.relatedEventIds = [...new Set(relatedEventIds)];
    if (!parentEventId && !sourceEventId && relatedEventIds.length === 0) return;
    metadata.relationType = normalizeRelationType(readString(raw, "relationType"));
    addString(metadata, "relationLabel", readString(raw, "relationLabel") ?? null);
    addString(metadata, "relationExplanation", readString(raw, "relationExplanation") ?? null);
}

function applyAsync(metadata: Record<string, unknown>, raw: Record<string, unknown>): void {
    const asyncTaskId = readString(raw, "asyncTaskId");
    if (!asyncTaskId) return;
    metadata.asyncTaskId = asyncTaskId;
    addString(metadata, "asyncStatus", readString(raw, "asyncStatus") ?? null);
    addString(metadata, "asyncAgent", readString(raw, "asyncAgent") ?? readString(raw, "agentName") ?? null);
    addString(metadata, "asyncCategory", readString(raw, "asyncCategory") ?? null);
    const durationMs = readNumber(raw, "durationMs");
    if (durationMs != null) metadata.durationMs = durationMs;
}

function applyTags(
    metadata: Record<string, unknown>,
    raw: Record<string, unknown>,
    classificationTags: readonly string[],
): readonly string[] {
    const tags = new Set<string>();
    for (const tag of readTags(raw["tags"])) tags.add(tag);
    for (const tag of classificationTags) {
        const trimmed = tag.trim();
        if (trimmed) tags.add(trimmed);
    }
    const merged = [...tags];
    if (merged.length > 0) metadata.tags = merged;
    return merged;
}

function applyTodo(metadata: Record<string, unknown>, raw: Record<string, unknown>): void {
    const todoId = readString(raw, "todoId");
    if (!todoId) return;
    const state = normalizeTodoState(readString(raw, "todoState"))
        ?? normalizeTodoState(readString(raw, "status"))
        ?? "added";
    metadata.todoId = todoId;
    metadata.todoState = state;
    metadata.status = state;
    addString(metadata, "priority", readString(raw, "priority") ?? null);
    if (readBoolean(raw, "autoReconciled")) metadata.autoReconciled = true;
}

function applyQuestion(metadata: Record<string, unknown>, raw: Record<string, unknown>): void {
    const questionId = readString(raw, "questionId");
    if (!questionId) return;
    const phase = normalizeQuestionPhase(readString(raw, "questionPhase")) ?? "asked";
    metadata.questionId = questionId;
    metadata.questionPhase = phase;
    const sequence = readNumber(raw, "sequence");
    if (sequence != null) metadata.sequence = sequence;
    addString(metadata, "modelName", readString(raw, "modelName") ?? readString(raw, "model") ?? null);
    addString(metadata, "modelProvider", readString(raw, "modelProvider") ?? null);
}

function applyTokenUsage(metadata: Record<string, unknown>, raw: Record<string, unknown>): void {
    // 명시 token.usage가 없으면 status-line context snapshot 값을 대체값으로 사용한다.
    const inputTokens = readNumber(raw, "inputTokens")
        ?? readNumber(raw, "lastTurnInputTokens")
        ?? readNumber(raw, "contextWindowInputTokens")
        ?? 0;
    const outputTokens = readNumber(raw, "outputTokens")
        ?? readNumber(raw, "lastTurnOutputTokens")
        ?? readNumber(raw, "contextWindowOutputTokens")
        ?? 0;
    const cacheReadTokens = readNumber(raw, "cacheReadTokens")
        ?? readNumber(raw, "lastTurnCachedInputTokens")
        ?? readNumber(raw, "contextWindowCacheReadTokens")
        ?? 0;
    const cacheCreateTokens = readNumber(raw, "cacheCreateTokens")
        ?? readNumber(raw, "contextWindowCacheCreationTokens")
        ?? 0;
    const costUsd = readNumber(raw, "costUsd") ?? readNumber(raw, "costTotalUsd");
    const durationMs = readNumber(raw, "durationMs");
    const model = readString(raw, "model") ?? readString(raw, "modelId");
    const promptId = readString(raw, "promptId");
    const stopReason = readString(raw, "stopReason") ?? readString(raw, "stop_reason");
    const hasUsage = inputTokens > 0 || outputTokens > 0 || cacheReadTokens > 0 || cacheCreateTokens > 0
        || costUsd != null || durationMs != null || Boolean(model) || Boolean(promptId) || Boolean(stopReason);
    if (!hasUsage) return;
    metadata.inputTokens = inputTokens;
    metadata.outputTokens = outputTokens;
    metadata.cacheReadTokens = cacheReadTokens;
    metadata.cacheCreateTokens = cacheCreateTokens;
    if (costUsd != null) metadata.costUsd = costUsd;
    if (durationMs != null) metadata.durationMs = durationMs;
    addString(metadata, "model", model ?? null);
    addString(metadata, "promptId", promptId ?? null);
    addString(metadata, "stopReason", stopReason ?? null);
}

function addString(metadata: Record<string, unknown>, key: string, value: string | null | undefined): void {
    if (value) metadata[key] = value;
}

import { QUESTION_PHASES, TODO_STATES } from "~activity/event/domain/common/const/event.kind.const.js";
import { isEventRelationType } from "~activity/event/domain/common/event.meta.helpers.js";

const TODO_STATE_SET = new Set<string>(TODO_STATES);
const QUESTION_PHASE_SET = new Set<string>(QUESTION_PHASES);

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

/** Keys whose values live in dedicated columns/tables — excluded from extras_json. */
export const DERIVED_METADATA_KEYS: ReadonlySet<string> = new Set<string>([
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

// Tool-call extras (readOffset, grepOutputMode, webPrompt, commandAnalysis,
// crossCheck, etc.) intentionally stay out of this set — they have no
// dedicated column and live in extras_json so the inspector and web can
// read them as raw metadata.

export function readString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
    const value = metadata?.[key];
    return typeof value === "string" && value.trim() ? value : undefined;
}

export function readStringArray(metadata: Record<string, unknown> | undefined, key: string): readonly string[] {
    const value = metadata?.[key];
    if (!Array.isArray(value)) return [];
    return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

export function readTags(value: unknown): readonly string[] {
    if (typeof value === "string") {
        return value.trim() ? [value.trim()] : [];
    }
    if (!Array.isArray(value)) return [];
    return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

export function readNumber(metadata: Record<string, unknown> | undefined, key: string): number | undefined {
    const value = metadata?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readBoolean(metadata: Record<string, unknown> | undefined, key: string): boolean | undefined {
    const value = metadata?.[key];
    return typeof value === "boolean" ? value : undefined;
}

export function normalizeRelationType(value: string | undefined): string {
    return isEventRelationType(value) ? value : "relates_to";
}

export function normalizeTodoState(value: string | undefined): string | undefined {
    return value && TODO_STATE_SET.has(value) ? value : undefined;
}

export function normalizeQuestionPhase(value: string | undefined): string | undefined {
    return value && QUESTION_PHASE_SET.has(value) ? value : undefined;
}

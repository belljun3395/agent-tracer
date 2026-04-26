import { META } from "../runtime/metadata.keys.const.js";
import { type EvidenceLevel, isEvidenceLevel } from "./task.status.js";
import { isTodoState } from "./event.kind.js";
import type {
    FileChangeMetadata,
    TodoLoggedMetadata,
} from "./event.metadata.type.js";

export type * from "./event.metadata.type.js";

type UnknownMetadata = Record<string, unknown> | undefined;
export function readTodoLoggedMetadata(metadata: UnknownMetadata): TodoLoggedMetadata {
    const todoId = readString(metadata, META.todoId);
    const todoState = readString(metadata, META.todoState);
    const toolName = readString(metadata, META.toolName);
    const priority = readString(metadata, META.priority);
    const status = readString(metadata, META.status);
    const autoReconciled = readBoolean(metadata, META.autoReconciled);

    return {
        ...(todoId ? { todoId } : {}),
        ...(isTodoState(todoState) ? { todoState } : {}),
        ...(toolName ? { toolName } : {}),
        ...(priority ? { priority } : {}),
        ...(status ? { status } : {}),
        ...(autoReconciled === true ? { autoReconciled: true } : {}),
    };
}

export function readFileChangeMetadata(metadata: UnknownMetadata): FileChangeMetadata {
    const filePath = readString(metadata, META.filePath);
    return {
        writeCount: readNumber(metadata, META.writeCount) ?? 0,
        ...(filePath ? { filePath } : {}),
        filePaths: readStringArray(metadata, META.filePaths),
    };
}

export function readDisplayTitle(metadata: UnknownMetadata): string | undefined {
    const value = readString(metadata, META.displayTitle)?.trim();
    return value || undefined;
}

export function readVerificationStatus(metadata: UnknownMetadata): string | undefined {
    return readString(metadata, META.verificationStatus);
}

export function readRuleStatus(metadata: UnknownMetadata): string | undefined {
    return readString(metadata, META.ruleStatus);
}

export function readEvidenceLevel(metadata: UnknownMetadata): EvidenceLevel | undefined {
    const value = readString(metadata, META.evidenceLevel);
    if (value && isEvidenceLevel(value)) {
        return value;
    }
    return undefined;
}

export function readFilePaths(metadata: UnknownMetadata): readonly string[] {
    return readStringArray(metadata, META.filePaths);
}
export function readString(metadata: UnknownMetadata, key: string): string | undefined {
    const value = metadata?.[key];
    return typeof value === "string" ? value : undefined;
}

function readNumber(metadata: UnknownMetadata, key: string): number | undefined {
    const value = metadata?.[key];
    return typeof value === "number" ? value : undefined;
}

function readBoolean(metadata: UnknownMetadata, key: string): boolean | undefined {
    const value = metadata?.[key];
    return typeof value === "boolean" ? value : undefined;
}

export function readStringArray(metadata: UnknownMetadata, key: string): readonly string[] {
    const value = metadata?.[key];
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

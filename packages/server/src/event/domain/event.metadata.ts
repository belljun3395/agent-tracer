import { META } from "~event/domain/runtime/const/metadata.keys.const.js";
import { isTodoState } from "~event/domain/common/event.kind.js";
import { isEvidenceLevel } from "~event/domain/common/event.meta.helpers.js";
import type { EvidenceLevel } from "~event/domain/common/type/event.meta.type.js";
import type {
    FileChangeMetadata,
    TodoLoggedMetadata,
} from "./type/event.metadata.type.js";
import type { DisplayTitleMetadataUpdate } from "./model/event.metadata.model.js";

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

export function resolveDisplayTitleMetadataUpdate(
    metadata: UnknownMetadata,
    eventTitle: string,
    displayTitle: string | null | undefined,
): DisplayTitleMetadataUpdate {
    const nextMetadata = { ...(metadata ?? {}) };
    const nextDisplayTitle = typeof displayTitle === "string"
        ? displayTitle.trim()
        : null;
    const normalizedDisplayTitle = nextDisplayTitle && nextDisplayTitle !== eventTitle.trim()
        ? nextDisplayTitle
        : null;
    const currentDisplayTitle = readDisplayTitle(metadata) ?? null;
    if ((normalizedDisplayTitle ?? null) === (currentDisplayTitle ?? null)) {
        return { metadata: nextMetadata, changed: false };
    }
    if (normalizedDisplayTitle) {
        nextMetadata[META.displayTitle] = normalizedDisplayTitle;
    } else {
        delete nextMetadata[META.displayTitle];
    }
    return { metadata: nextMetadata, changed: true };
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

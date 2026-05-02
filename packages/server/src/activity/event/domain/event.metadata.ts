import { META } from "~activity/event/domain/runtime/const/metadata.keys.const.js";
import type { DisplayTitleMetadataUpdate } from "./model/event.metadata.model.js";

type UnknownMetadata = Record<string, unknown> | undefined;

function readDisplayTitle(metadata: UnknownMetadata): string | undefined {
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

export function readFilePaths(metadata: UnknownMetadata): readonly string[] {
    return readStringArray(metadata, META.filePaths);
}
export function readString(metadata: UnknownMetadata, key: string): string | undefined {
    const value = metadata?.[key];
    return typeof value === "string" ? value : undefined;
}

export function readStringArray(metadata: UnknownMetadata, key: string): readonly string[] {
    const value = metadata?.[key];
    if (!Array.isArray(value)) {
        return [];
    }
    return value.filter((entry): entry is string => typeof entry === "string");
}

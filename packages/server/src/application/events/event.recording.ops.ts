import type { EventInsertInput } from "~application/ports/index.js";
import type { EventClassification } from "~domain/index.js";
import type { BaseIngestEventInput } from "./log.event.usecase.dto.js";

export function normalizeFilePaths(filePaths: readonly string[] | undefined): readonly string[] {
    if (!filePaths || filePaths.length === 0) return [];
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const fp of filePaths) {
        const trimmed = fp.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        normalized.push(trimmed);
    }
    return normalized;
}

export function buildEventRecord(input: BaseIngestEventInput): Omit<EventInsertInput, "id"> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const filePaths = normalizeFilePaths(input.filePaths);
    const contextualTags = Array.from(new Set<string>((input.metadata?.tags as readonly string[] | undefined) ?? []));
    const metadata: Record<string, unknown> = {
        ...(input.metadata ?? {}),
        ...(filePaths.length > 0 ? { filePaths } : {}),
        ...(input.parentEventId ? { parentEventId: input.parentEventId } : {}),
        ...(input.relatedEventIds?.length ? { relatedEventIds: [...input.relatedEventIds] } : {}),
        ...(input.relationType ? { relationType: input.relationType } : {}),
        ...(input.relationLabel ? { relationLabel: input.relationLabel } : {}),
        ...(input.relationExplanation ? { relationExplanation: input.relationExplanation } : {}),
    };
    const classification: EventClassification = {
        lane: input.lane,
        tags: contextualTags,
        matches: [],
    };
    return {
        taskId: input.taskId,
        kind: input.kind,
        lane: input.lane,
        title: input.title ?? input.kind,
        metadata,
        classification,
        createdAt,
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
        ...(input.body ? { body: input.body } : {}),
    };
}

import type { TimelineEvent } from "./type/timeline.event.type.js";
import { isBackgroundLane, isExplorationLane } from "./event.predicates.policy.js";
import { KIND } from "@monitor/timeline-api/event/domain/common/const/event.kind.const.js";
import type { EventRecordingInput, EventRecordDraft } from "./type/event.recording.type.js";
import type { EventClassification } from "./type/timeline.event.type.js";

const MAX_DERIVED_FILE_EVENTS = 15;

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

export function createEventRecordDraft(input: EventRecordingInput): EventRecordDraft {
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

export function deriveFileChangeEventInputs(input: {
    readonly sourceEvent: TimelineEvent;
    readonly filePaths: readonly string[];
    readonly sessionId?: string;
}): readonly EventRecordingInput[] {
    if (isExplorationLane(input.sourceEvent.lane) || isBackgroundLane(input.sourceEvent.lane)) return [];
    return input.filePaths.slice(0, MAX_DERIVED_FILE_EVENTS).map((filePath) => ({
        taskId: input.sourceEvent.taskId,
        kind: KIND.fileChanged,
        lane: "implementation",
        title: filePath.split("/").at(-1) ?? filePath,
        body: filePath,
        filePaths: [filePath],
        metadata: { sourceKind: input.sourceEvent.kind, sourceEventId: input.sourceEvent.id },
        ...(input.sessionId ? { sessionId: input.sessionId } : {}),
    }));
}

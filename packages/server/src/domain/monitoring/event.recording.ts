import type { MonitoringEventKind, TimelineLane } from "./event.kind.js";
import type { EventClassification } from "./timeline.event.js";
import type { EventRelationType } from "./task.status.js";

export interface EventRecordingInput {
    readonly kind: MonitoringEventKind;
    readonly taskId: string;
    readonly sessionId?: string | undefined;
    readonly title?: string | undefined;
    readonly body?: string | undefined;
    readonly lane: TimelineLane;
    readonly filePaths?: readonly string[] | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
    readonly parentEventId?: string | undefined;
    readonly relatedEventIds?: readonly string[] | undefined;
    readonly relationType?: EventRelationType | undefined;
    readonly relationLabel?: string | undefined;
    readonly relationExplanation?: string | undefined;
    readonly createdAt?: string | undefined;
}

export interface EventRecordDraft {
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: MonitoringEventKind;
    readonly lane: TimelineLane;
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: EventClassification;
    readonly createdAt: string;
}

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

export function buildEventRecord(input: EventRecordingInput): EventRecordDraft {
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

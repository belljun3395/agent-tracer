import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import { resolveSemanticView } from "~domain/monitoring/event/event.semantic.js";
import { resolveTimelineEventPaths } from "~domain/monitoring/event/timeline.event.paths.js";

export interface TimelineEventProjection {
    readonly id: string;
    readonly taskId: string;
    readonly sessionId?: string;
    readonly kind: TimelineEvent["kind"];
    readonly lane: TimelineEvent["lane"];
    readonly title: string;
    readonly body?: string;
    readonly metadata: Record<string, unknown>;
    readonly classification: TimelineEvent["classification"];
    readonly createdAt: string;
    readonly semantic?: {
        readonly subtypeKey: string;
        readonly subtypeLabel: string;
        readonly subtypeGroup?: string;
        readonly entityType?: string;
        readonly entityName?: string;
    };
    readonly paths: {
        readonly primaryPath?: string;
        readonly filePaths: readonly string[];
        readonly mentionedPaths: readonly string[];
    };
}

export function projectTimelineEvent(event: TimelineEvent): TimelineEventProjection {
    const semantic = resolveSemanticView(event);
    const paths = resolveTimelineEventPaths(event);

    return {
        id: event.id,
        taskId: event.taskId,
        ...(event.sessionId !== undefined ? { sessionId: event.sessionId } : {}),
        kind: event.kind,
        lane: event.lane,
        title: event.title,
        ...(event.body !== undefined ? { body: event.body } : {}),
        metadata: event.metadata,
        classification: event.classification,
        createdAt: event.createdAt,
        ...(semantic ? {
            semantic: {
                subtypeKey: semantic.subtypeKey,
                subtypeLabel: semantic.subtypeLabel,
                ...(semantic.subtypeGroup !== undefined ? { subtypeGroup: semantic.subtypeGroup } : {}),
                ...(semantic.entityType !== undefined ? { entityType: semantic.entityType } : {}),
                ...(semantic.entityName !== undefined ? { entityName: semantic.entityName } : {}),
            },
        } : {}),
        paths: {
            ...(paths.primaryPath !== undefined ? { primaryPath: paths.primaryPath } : {}),
            filePaths: paths.filePaths,
            mentionedPaths: paths.mentionedPaths,
        },
    };
}

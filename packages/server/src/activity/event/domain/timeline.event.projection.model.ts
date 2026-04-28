import type { TimelineEvent } from "~activity/event/domain/model/timeline.event.model.js";
import { resolveSemanticView } from "~activity/event/domain/event.semantic.js";
import { resolveTimelineEventPaths } from "~activity/event/domain/timeline.event.paths.js";
import type { TimelineEventProjection } from "../public/dto/timeline.event.dto.js";

/**
 * Domain model — projects an internal TimelineEvent into the wire-format
 * TimelineEventProjection. Encapsulates the semantic-view + path-resolution
 * rules in one place. Used by WS notifications, event.logged payloads, etc.
 */
export class TimelineEventProjector {
    constructor(private readonly event: TimelineEvent) {}

    project(): TimelineEventProjection {
        const semantic = resolveSemanticView(this.event);
        const paths = resolveTimelineEventPaths(this.event);

        return {
            id: this.event.id,
            taskId: this.event.taskId,
            ...(this.event.sessionId !== undefined ? { sessionId: this.event.sessionId } : {}),
            kind: this.event.kind,
            lane: this.event.lane,
            title: this.event.title,
            ...(this.event.body !== undefined ? { body: this.event.body } : {}),
            metadata: this.event.metadata,
            classification: this.event.classification,
            createdAt: this.event.createdAt,
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
}

/** Convenience for callers that just want to project once. */
export function projectTimelineEvent(event: TimelineEvent): TimelineEventProjection {
    return new TimelineEventProjector(event).project();
}

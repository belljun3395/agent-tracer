import type { TimelineEvent } from "@monitor/timeline-api/event/domain/type/timeline.event.type.js";
import { resolveSemanticView } from "@monitor/timeline-api/event/domain/event.semantic.policy.js";
import { resolveTimelineEventPaths } from "@monitor/timeline-api/event/domain/timeline.event.paths.policy.js";
import type { TimelineEventProjection } from "../public/dto/timeline.event.dto.js";

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

export function projectTimelineEvent(event: TimelineEvent): TimelineEventProjection {
    return new TimelineEventProjector(event).project();
}

import { readDisplayTitle, resolveSemanticView, resolveTimelineEventPaths, type TimelineEvent } from "~domain/index.js";
import type { IEventRepository, INotificationPublisher } from "../ports/index.js";
import type {
    UpdateEventRecordUseCaseDto,
    UpdateEventUseCaseIn,
    UpdateEventUseCaseOut,
} from "./dto/update.event.usecase.dto.js";

export class UpdateEventUseCase {
    constructor(
        private readonly eventRepo: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: UpdateEventUseCaseIn): Promise<UpdateEventUseCaseOut> {
        const event = await this.eventRepo.findById(input.eventId);
        if (!event) return null;

        const nextMetadata = { ...event.metadata };
        const nextDisplayTitle = typeof input.displayTitle === "string"
            ? input.displayTitle.trim()
            : null;
        const normalizedDisplayTitle = nextDisplayTitle &&
            nextDisplayTitle !== event.title.trim()
            ? nextDisplayTitle
            : null;
        const currentDisplayTitle = readDisplayTitle(event.metadata) ?? null;
        if ((normalizedDisplayTitle ?? null) === (currentDisplayTitle ?? null)) {
            return toUpdateEventRecord(event);
        }
        if (normalizedDisplayTitle) {
            nextMetadata["displayTitle"] = normalizedDisplayTitle;
        } else {
            delete nextMetadata["displayTitle"];
        }
        const updated = await this.eventRepo.updateMetadata(event.id, nextMetadata);
        if (updated) {
            this.notifier.publish({
                type: "event.updated",
                payload: toUpdateEventRecord(updated),
            });
        }
        return updated ? toUpdateEventRecord(updated) : null;
    }
}

function toUpdateEventRecord(event: TimelineEvent): UpdateEventRecordUseCaseDto {
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

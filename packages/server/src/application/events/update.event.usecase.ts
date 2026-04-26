import { resolveDisplayTitleMetadataUpdate } from "~domain/monitoring/event/event.metadata.js";
import type { NotificationPublisherPort } from "~application/ports/notifications/notification.publisher.port.js";
import type { TimelineEventReadPort } from "~application/ports/timeline-events/timeline.event.read.port.js";
import type { TimelineEventWritePort } from "~application/ports/timeline-events/timeline.event.write.port.js";
import type {
    UpdateEventUseCaseIn,
    UpdateEventUseCaseOut,
} from "./dto/update.event.usecase.dto.js";
import { projectTimelineEvent } from "./timeline-event.projection.js";

export class UpdateEventUseCase {
    constructor(
        private readonly eventRepo: TimelineEventReadPort & TimelineEventWritePort,
        private readonly notifier: NotificationPublisherPort,
    ) {}

    async execute(input: UpdateEventUseCaseIn): Promise<UpdateEventUseCaseOut> {
        const event = await this.eventRepo.findById(input.eventId);
        if (!event) return null;

        const metadataUpdate = resolveDisplayTitleMetadataUpdate(event.metadata, event.title, input.displayTitle);
        if (!metadataUpdate.changed) {
            return projectTimelineEvent(event);
        }
        const updated = await this.eventRepo.updateMetadata(event.id, metadataUpdate.metadata);
        if (updated) {
            this.notifier.publish({
                type: "event.updated",
                payload: projectTimelineEvent(updated),
            });
        }
        return updated ? projectTimelineEvent(updated) : null;
    }
}

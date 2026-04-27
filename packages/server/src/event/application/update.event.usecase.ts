import { Inject, Injectable } from "@nestjs/common";
import { resolveDisplayTitleMetadataUpdate } from "~domain/monitoring/event/event.metadata.js";
import type { TimelineEvent } from "~domain/monitoring/event/model/timeline.event.model.js";
import { TimelineEventService } from "../service/timeline.event.service.js";
import { projectTimelineEvent } from "../domain/timeline.event.projection.model.js";
import { NOTIFICATION_PUBLISHER_PORT } from "./outbound/tokens.js";
import type { IEventNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type {
    UpdateEventUseCaseIn,
    UpdateEventUseCaseOut,
} from "./dto/update.event.usecase.dto.js";

@Injectable()
export class UpdateEventUseCase {
    constructor(
        private readonly events: TimelineEventService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IEventNotificationPublisher,
    ) {}

    async execute(input: UpdateEventUseCaseIn): Promise<UpdateEventUseCaseOut> {
        const event = await this.events.findById(input.eventId);
        if (!event) return null;

        const internal = event as unknown as TimelineEvent;
        const metadataUpdate = resolveDisplayTitleMetadataUpdate(internal.metadata, internal.title, input.displayTitle);
        if (!metadataUpdate.changed) {
            return projectTimelineEvent(internal) as UpdateEventUseCaseOut;
        }
        const updated = await this.events.updateMetadata(event.id, metadataUpdate.metadata);
        if (updated) {
            const projected = projectTimelineEvent(updated as unknown as TimelineEvent);
            this.notifier.publish({
                type: "event.updated",
                payload: projected as never,
            });
            return projected as UpdateEventUseCaseOut;
        }
        return null;
    }
}

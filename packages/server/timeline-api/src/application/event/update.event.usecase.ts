import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { resolveDisplayTitleMetadataUpdate } from "@monitor/timeline-api/domain/event/event.metadata.policy.js";
import { projectTimelineEvent } from "@monitor/timeline-api/domain/event/timeline.event.projection.policy.js";
import { NOTIFICATION_PUBLISHER_PORT } from "@monitor/timeline-api/application/event/outbound/tokens.js";
import { TimelineEventStorageService } from "@monitor/timeline-api/service/event/timeline.event.storage.service.js";
import type { IEventNotificationPublisher } from "@monitor/timeline-api/application/event/outbound/notification.publisher.port.js";
import type {
    UpdateEventUseCaseIn,
    UpdateEventUseCaseOut,
} from "@monitor/timeline-api/application/event/dto/update.event.usecase.dto.js";

@Injectable()
export class UpdateEventUseCase {
    constructor(
        private readonly events: TimelineEventStorageService,
        @Inject(NOTIFICATION_PUBLISHER_PORT) private readonly notifier: IEventNotificationPublisher,
    ) {}

    @Transactional()
    async execute(input: UpdateEventUseCaseIn): Promise<UpdateEventUseCaseOut> {
        const event = await this.events.findById(input.eventId);
        if (!event) return null;

        const metadataUpdate = resolveDisplayTitleMetadataUpdate(event.metadata, event.title, input.displayTitle);
        if (!metadataUpdate.changed) {
            return projectTimelineEvent(event);
        }
        const updated = await this.events.updateMetadata(event.id, metadataUpdate.metadata);
        if (!updated) return null;
        const projected = projectTimelineEvent(updated);
        this.notifier.publish({ type: NOTIFICATION_TYPE.eventUpdated, payload: projected });
        return projected;
    }
}

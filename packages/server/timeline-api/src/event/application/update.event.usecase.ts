import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_TYPE } from "@monitor/shared/contracts/notifications/notification.type.const.js";
import { Transactional } from "typeorm-transactional";
import { resolveDisplayTitleMetadataUpdate } from "@monitor/timeline-api/event/domain/event.metadata.policy.js";
import { projectTimelineEvent } from "../domain/timeline.event.projection.policy.js";
import { EVENT_PERSISTENCE_PORT, NOTIFICATION_PUBLISHER_PORT } from "./outbound/tokens.js";
import type { IEventPersistence } from "./outbound/event.persistence.port.js";
import type { IEventNotificationPublisher } from "./outbound/notification.publisher.port.js";
import type {
    UpdateEventUseCaseIn,
    UpdateEventUseCaseOut,
} from "./dto/update.event.usecase.dto.js";

@Injectable()
export class UpdateEventUseCase {
    constructor(
        @Inject(EVENT_PERSISTENCE_PORT) private readonly events: IEventPersistence,
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

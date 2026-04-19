import { readDisplayTitle } from "~domain/index.js";
import { mapTimelineEventToRecord, type TimelineEventRecord } from "../views/index.js";
import type { IEventRepository, INotificationPublisher } from "../ports/index.js";
import type { EventPatchInput } from "./event.write.type.js";

export class UpdateEventUseCase {
    constructor(
        private readonly eventRepo: IEventRepository,
        private readonly notifier: INotificationPublisher,
    ) {}

    async execute(input: EventPatchInput): Promise<TimelineEventRecord | null> {
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
            return mapTimelineEventToRecord(event);
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
                payload: mapTimelineEventToRecord(updated),
            });
        }
        return updated ? mapTimelineEventToRecord(updated) : null;
    }
}

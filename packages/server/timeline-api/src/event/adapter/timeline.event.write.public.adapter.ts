import { Inject, Injectable } from "@nestjs/common";
import { EVENT_PERSISTENCE_PORT } from "../application/outbound/tokens.js";
import type { IEventPersistence } from "../application/outbound/event.persistence.port.js";
import type {
    ITimelineEventWrite,
    TimelineEventWriteInput,
} from "../public/iservice/timeline.event.write.iservice.js";
import type { TimelineEventSnapshot } from "../public/dto/timeline.event.dto.js";

@Injectable()
export class TimelineEventWritePublicAdapter implements ITimelineEventWrite {
    constructor(
        @Inject(EVENT_PERSISTENCE_PORT) private readonly persistence: IEventPersistence,
    ) {}

    async insert(input: TimelineEventWriteInput): Promise<TimelineEventSnapshot> {
        return this.persistence.insert(input);
    }
}

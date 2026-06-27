import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EVENT_RECORDED } from "@monitor/timeline-api/event/public/events/event.recorded.js";
import type { EventRecordedPayload } from "@monitor/timeline-api/event/public/events/event.recorded.js";
import { KIND } from "@monitor/timeline-api/event/public/types/event.const.js";
import { VerificationPostProcessorPublicAdapter } from "../adapter/verification.post.processor.public.adapter.js";

@Injectable()
export class EventRecordedVerificationSubscriber {
    constructor(
        private readonly processor: VerificationPostProcessorPublicAdapter,
    ) {}

    @OnEvent(EVENT_RECORDED, { suppressErrors: false })
    async onEventRecorded(payload: EventRecordedPayload): Promise<void> {
        for (const event of payload.events) {
            if (event.kind === KIND.userMessage) {
                await this.processor.onUserMessage(event);
            } else if (event.kind === KIND.assistantResponse) {
                await this.processor.onAssistantResponse(event);
            } else {
                await this.processor.onOtherEvent(event);
            }
        }
    }
}

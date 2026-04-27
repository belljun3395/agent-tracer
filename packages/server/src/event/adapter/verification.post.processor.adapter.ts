import { Inject, Injectable } from "@nestjs/common";
import type {
    IVerificationPostProcessor as IVerificationPostProcessorPublic,
} from "~verification/public/iservice/verification.post.processor.iservice.js";
import { VERIFICATION_POST_PROCESSOR } from "~verification/public/tokens.js";
import type {
    IVerificationPostProcessor,
    PostProcessableEvent,
} from "../application/outbound/verification.post.processor.port.js";

/**
 * Outbound adapter — bridges verification.public IVerificationPostProcessor
 * to the event-local port. The verification module owns the fan-out into
 * RuleEnforcementPostProcessor / TurnLifecyclePostProcessor.
 */
@Injectable()
export class VerificationPostProcessorAdapter implements IVerificationPostProcessor {
    constructor(
        @Inject(VERIFICATION_POST_PROCESSOR)
        private readonly inner: IVerificationPostProcessorPublic,
    ) {}

    onUserMessage(event: PostProcessableEvent): Promise<void> {
        return this.inner.onUserMessage(event as never);
    }

    onAssistantResponse(event: PostProcessableEvent): Promise<void> {
        return this.inner.onAssistantResponse(event as never);
    }

    onOtherEvent(event: PostProcessableEvent): Promise<void> {
        return this.inner.onOtherEvent(event as never);
    }
}

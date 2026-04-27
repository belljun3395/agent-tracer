import { Injectable } from "@nestjs/common";
import { RuleEnforcementPostProcessor } from "~application/verification/services/rule.enforcement.post.processor.js";
import { TurnLifecyclePostProcessor } from "~application/verification/services/turn.lifecycle.post.processor.js";
import type {
    IVerificationPostProcessor,
    PostProcessableEvent,
} from "../application/outbound/verification.post.processor.port.js";

/**
 * Outbound adapter — bridges legacy verification post-processor services to
 * the event-local IVerificationPostProcessor port. Will be retargeted at the
 * verification module's public iservice when that module is split out.
 */
@Injectable()
export class VerificationPostProcessorAdapter implements IVerificationPostProcessor {
    constructor(
        private readonly ruleEnforcement: RuleEnforcementPostProcessor,
        private readonly turnLifecycle: TurnLifecyclePostProcessor,
    ) {}

    async onUserMessage(event: PostProcessableEvent): Promise<void> {
        await this.turnLifecycle.processLoggedEvent(event as never);
        await this.ruleEnforcement.processLoggedEvent(event as never);
    }

    async onAssistantResponse(event: PostProcessableEvent): Promise<void> {
        await this.ruleEnforcement.processLoggedEvent(event as never);
        await this.turnLifecycle.processLoggedEvent(event as never);
    }

    async onOtherEvent(event: PostProcessableEvent): Promise<void> {
        await this.ruleEnforcement.processLoggedEvent(event as never);
        await this.turnLifecycle.processLoggedEvent(event as never);
    }
}

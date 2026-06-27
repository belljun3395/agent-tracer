import { Inject, Injectable } from "@nestjs/common";
import { RuleEnforcementPostProcessor } from "../service/rule.enforcement.post.processor.js";
import { TurnLifecyclePostProcessor } from "../service/turn.lifecycle.post.processor.js";
import type {
    IVerificationPostProcessor,
    VerificationPostProcessorEvent,
} from "../public/iservice/verification.post.processor.iservice.js";

@Injectable()
export class VerificationPostProcessorPublicAdapter implements IVerificationPostProcessor {
    constructor(
        @Inject(RuleEnforcementPostProcessor) private readonly ruleEnforcement: RuleEnforcementPostProcessor,
        @Inject(TurnLifecyclePostProcessor) private readonly turnLifecycle: TurnLifecyclePostProcessor,
    ) {}

    async onUserMessage(event: VerificationPostProcessorEvent): Promise<void> {
        await this.turnLifecycle.processLoggedEvent(event);
        await this.ruleEnforcement.processLoggedEvent(event);
    }

    async onAssistantResponse(event: VerificationPostProcessorEvent): Promise<void> {
        await this.ruleEnforcement.processLoggedEvent(event);
        await this.turnLifecycle.processLoggedEvent(event);
    }

    async onOtherEvent(event: VerificationPostProcessorEvent): Promise<void> {
        await this.ruleEnforcement.processLoggedEvent(event);
    }
}

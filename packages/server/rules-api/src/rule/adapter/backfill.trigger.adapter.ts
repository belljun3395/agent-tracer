import { Inject, Injectable } from "@nestjs/common";
import type { IVerificationBackfill } from "@monitor/rules-api/verification/public/iservice/verification.backfill.iservice.js";
import { VERIFICATION_BACKFILL } from "@monitor/rules-api/verification/public/tokens.js";
import type {
    BackfillTriggerInput,
    BackfillTriggerResult,
    IBackfillTrigger,
} from "../application/outbound/backfill.trigger.port.js";

@Injectable()
export class BackfillTriggerAdapter implements IBackfillTrigger {
    constructor(
        @Inject(VERIFICATION_BACKFILL) private readonly inner: IVerificationBackfill,
    ) {}

    async trigger(input: BackfillTriggerInput): Promise<BackfillTriggerResult> {
        const result = await this.inner.backfill(input.rule);
        return {
            turnsConsidered: result.turnsConsidered,
            turnsEvaluated: result.turnsEvaluated,
            verdictsCreated: result.verdictsCreated,
        };
    }
}

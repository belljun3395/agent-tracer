import { Inject, Injectable } from "@nestjs/common";
import type { IVerdictInvalidation } from "@monitor/rules-api/verification/public/iservice/verdict.invalidation.iservice.js";
import { VERIFICATION_VERDICT_INVALIDATION } from "@monitor/rules-api/verification/public/tokens.js";
import type { IVerificationInvalidation } from "../application/outbound/verification.invalidation.port.js";

@Injectable()
export class VerificationInvalidationAdapter implements IVerificationInvalidation {
    constructor(
        @Inject(VERIFICATION_VERDICT_INVALIDATION) private readonly inner: IVerdictInvalidation,
    ) {}

    deleteVerdictsByRuleId(ruleId: string): Promise<void> {
        return this.inner.deleteVerdictsByRuleId(ruleId);
    }

    deleteEnforcementsByRuleId(ruleId: string): Promise<void> {
        return this.inner.deleteEnforcementsByRuleId(ruleId);
    }
}

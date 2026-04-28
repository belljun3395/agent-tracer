import { Inject, Injectable } from "@nestjs/common";
import type { IVerdictInvalidation } from "~governance/verification/public/iservice/verdict.invalidation.iservice.js";
import { VERIFICATION_VERDICT_INVALIDATION } from "~governance/verification/public/tokens.js";
import type { IVerificationInvalidation } from "../application/outbound/verification.invalidation.port.js";

/**
 * Outbound adapter — wraps the verification module's public
 * IVerdictInvalidation iservice to satisfy the rule-side port.
 */
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

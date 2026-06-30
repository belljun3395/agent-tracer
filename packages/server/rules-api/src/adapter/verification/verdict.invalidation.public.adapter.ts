import { Injectable } from "@nestjs/common";
import { VerdictRepository } from "../../repository/verification/verdict.repository.js";
import { RuleEnforcementRepository } from "../../repository/verification/rule.enforcement.repository.js";
import type { IVerdictInvalidation } from "../../public/verification/iservice/verdict.invalidation.iservice.js";

@Injectable()
export class VerdictInvalidationPublicAdapter implements IVerdictInvalidation {
    constructor(
        private readonly verdicts: VerdictRepository,
        private readonly enforcements: RuleEnforcementRepository,
    ) {}

    async deleteVerdictsByRuleId(ruleId: string): Promise<void> {
        await this.verdicts.deleteByRuleId(ruleId);
    }

    async deleteEnforcementsByRuleId(ruleId: string): Promise<void> {
        await this.enforcements.deleteByRuleId(ruleId);
    }
}

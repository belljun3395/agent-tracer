import { Inject, Injectable } from "@nestjs/common";
import type { IVerdictRepository } from "~verification/application/outbound/verdict.repository.port.js";
import type { IRuleEnforcementRepository } from "~verification/application/outbound/rule.enforcement.repository.port.js";
import {
    RULE_ENFORCEMENT_REPOSITORY_TOKEN,
    VERDICT_REPOSITORY_TOKEN,
} from "../repository/tokens.js";
import type { IVerdictInvalidation } from "../public/iservice/verdict.invalidation.iservice.js";

/**
 * Public adapter — implements IVerdictInvalidation by clearing verdicts and
 * rule_enforcements for a given rule. Wraps the legacy repos until the
 * verification persistence tier moves to TypeORM.
 */
@Injectable()
export class VerdictInvalidationPublicAdapter implements IVerdictInvalidation {
    constructor(
        @Inject(VERDICT_REPOSITORY_TOKEN) private readonly verdicts: IVerdictRepository,
        @Inject(RULE_ENFORCEMENT_REPOSITORY_TOKEN) private readonly enforcements: IRuleEnforcementRepository,
    ) {}

    async deleteVerdictsByRuleId(ruleId: string): Promise<void> {
        await this.verdicts.deleteByRuleId(ruleId);
    }

    async deleteEnforcementsByRuleId(ruleId: string): Promise<void> {
        await this.enforcements.deleteByRuleId(ruleId);
    }
}

import { Inject, Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { RULE_PERSISTENCE_PORT } from "./outbound/tokens.js";
import type { IRulePersistence } from "./outbound/rule.persistence.port.js";
import { CreateRuleUseCase } from "./create.rule.usecase.js";
import { DeleteRuleUseCase } from "./delete.rule.usecase.js";
import type {
    PromoteRuleToGlobalUseCaseIn,
    PromoteRuleToGlobalUseCaseOut,
} from "./dto/promote.rule.to.global.usecase.dto.js";
import { InvalidRuleError, RuleNotFoundError } from "../common/errors.js";

export type {
    PromoteRuleToGlobalUseCaseIn,
    PromoteRuleToGlobalUseCaseOut,
} from "./dto/promote.rule.to.global.usecase.dto.js";

/**
 * Promote a task-scoped rule to global. Implementation: soft-delete the
 * task rule (keeps audit trail of any past verdicts), create a fresh
 * global rule with identical trigger/expect via CreateRuleUseCase (which
 * also triggers backfill across all sessions).
 */
@Injectable()
export class PromoteRuleToGlobalUseCase {
    constructor(
        @Inject(RULE_PERSISTENCE_PORT) private readonly ruleRepo: IRulePersistence,
        private readonly createRule: CreateRuleUseCase,
        private readonly deleteRule: DeleteRuleUseCase,
    ) {}

    @Transactional()
    async execute(input: PromoteRuleToGlobalUseCaseIn): Promise<PromoteRuleToGlobalUseCaseOut> {
        const existing = await this.ruleRepo.findById(input.ruleId);
        if (!existing) throw new RuleNotFoundError(input.ruleId);
        if (existing.scope !== "task") {
            throw new InvalidRuleError("Only task-scoped rules can be promoted");
        }
        await this.deleteRule.execute(input.ruleId);
        const created = await this.createRule.execute({
            name: existing.name,
            ...(existing.trigger ? { trigger: existing.trigger } : {}),
            ...(existing.triggerOn ? { triggerOn: existing.triggerOn } : {}),
            expect: existing.expect,
            scope: "global",
            source: existing.source,
            severity: existing.severity,
            ...(existing.rationale ? { rationale: existing.rationale } : {}),
        });
        return { rule: created.rule };
    }
}

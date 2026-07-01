import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import { CreateRuleUseCase } from "./create.rule.usecase.js";
import { DeleteRuleUseCase } from "./delete.rule.usecase.js";
import { RULE_SCOPE } from "../../domain/rule/const/rule.const.js";
import type {
    PromoteRuleToGlobalUseCaseIn,
    PromoteRuleToGlobalUseCaseOut,
} from "./dto/promote.rule.to.global.usecase.dto.js";
import { InvalidRuleError, RuleNotFoundError } from "../../domain/rule/errors.js";

@Injectable()
export class PromoteRuleToGlobalUseCase {
    constructor(
        private readonly ruleRepo: RuleRepository,
        private readonly createRule: CreateRuleUseCase,
        private readonly deleteRule: DeleteRuleUseCase,
    ) {}

    @Transactional()
    async execute(input: PromoteRuleToGlobalUseCaseIn): Promise<PromoteRuleToGlobalUseCaseOut> {
        const existing = await this.ruleRepo.findById(input.ruleId);
        if (!existing) throw new RuleNotFoundError(input.ruleId);
        if (existing.scope !== RULE_SCOPE.task) {
            // global 룰은 이미 전체 범위에 적용되므로 promote 대상이 아니다.
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

import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import { CreateRuleUseCase } from "./create.rule.usecase.js";
import { DeleteRuleUseCase } from "./delete.rule.usecase.js";
import { RULE_SCOPE } from "../../domain/rule/const/rule.const.js";
import type {
    DemoteRuleToTaskUseCaseIn,
    DemoteRuleToTaskUseCaseOut,
} from "./dto/demote.rule.to.task.usecase.dto.js";
import { InvalidRuleError, RuleNotFoundError } from "../../domain/rule/errors.js";

export type {
    DemoteRuleToTaskUseCaseIn,
    DemoteRuleToTaskUseCaseOut,
} from "./dto/demote.rule.to.task.usecase.dto.js";

@Injectable()
export class DemoteRuleToTaskUseCase {
    constructor(
        private readonly ruleRepo: RuleRepository,
        private readonly createRule: CreateRuleUseCase,
        private readonly deleteRule: DeleteRuleUseCase,
    ) {}

    @Transactional()
    async execute(input: DemoteRuleToTaskUseCaseIn): Promise<DemoteRuleToTaskUseCaseOut> {
        const existing = await this.ruleRepo.findById(input.ruleId);
        if (!existing) throw new RuleNotFoundError(input.ruleId);
        if (existing.scope !== RULE_SCOPE.global) {
            // task 룰은 이미 특정 태스크에 묶여 있으므로 demote 대상이 아니다.
            throw new InvalidRuleError("Only global rules can be demoted");
        }
        if (!input.taskId.trim()) {
            // demote는 새 task 스코프를 만들 대상 태스크가 필요하다.
            throw new InvalidRuleError("Demote requires a target taskId");
        }
        await this.deleteRule.execute(input.ruleId);
        const created = await this.createRule.execute({
            name: existing.name,
            ...(existing.trigger ? { trigger: existing.trigger } : {}),
            ...(existing.triggerOn ? { triggerOn: existing.triggerOn } : {}),
            expect: existing.expect,
            scope: "task",
            taskId: input.taskId,
            source: existing.source,
            severity: existing.severity,
            ...(existing.rationale ? { rationale: existing.rationale } : {}),
        });
        return { rule: created.rule };
    }
}

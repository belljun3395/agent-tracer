import { Injectable } from "@nestjs/common";
import { Transactional } from "typeorm-transactional";
import { computeRuleSignature } from "@monitor/rules-api/domain/rule/rule.predicates.policy.js";
import { RuleRepository } from "../../repository/rule/rule.repository.js";
import { CreateRuleUseCase } from "./create.rule.usecase.js";
import type {
    RegisterSuggestionUseCaseIn,
    RegisterSuggestionUseCaseOut,
} from "./dto/register.suggestion.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";

@Injectable()
export class RegisterSuggestionUseCase {
    constructor(
        private readonly ruleRepo: RuleRepository,
        private readonly createRule: CreateRuleUseCase,
    ) {}

    @Transactional()
    async execute(input: RegisterSuggestionUseCaseIn): Promise<RegisterSuggestionUseCaseOut> {
        const expect = {
            ...(input.expect.action !== undefined ? { action: input.expect.action } : {}),
            ...(input.expect.commandMatches !== undefined
                ? { commandMatches: input.expect.commandMatches }
                : {}),
            ...(input.expect.pattern !== undefined ? { pattern: input.expect.pattern } : {}),
        };
        const signature = computeRuleSignature({
            ...(input.trigger ? { trigger: input.trigger } : {}),
            ...(input.triggerOn ? { triggerOn: input.triggerOn } : {}),
            expect,
        });
        const existing = await this.ruleRepo.findBySignature(signature);
        if (existing) return { rule: mapRule(existing), created: false };
        const created = await this.createRule.execute({
            name: input.name,
            ...(input.trigger ? { trigger: input.trigger } : {}),
            ...(input.triggerOn ? { triggerOn: input.triggerOn } : {}),
            expect,
            scope: input.scope,
            ...(input.taskId ? { taskId: input.taskId } : {}),
            source: "agent",
            ...(input.severity ? { severity: input.severity } : {}),
            ...(input.rationale ? { rationale: input.rationale } : {}),
            signature,
        });
        return { rule: created.rule, created: true };
    }
}

import { computeRuleSignature } from "~domain/verification/index.js";
import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { CreateRuleUseCase } from "./create.rule.usecase.js";
import type {
    RegisterSuggestionUseCaseIn,
    RegisterSuggestionUseCaseOut,
} from "./dto/register.suggestion.usecase.dto.js";
import { mapRule } from "./dto/rule.dto.mapper.js";

export type {
    RegisterSuggestionUseCaseIn,
    RegisterSuggestionUseCaseOut,
} from "./dto/register.suggestion.usecase.dto.js";
export type { RegisterSuggestionUseCaseIn as RegisterSuggestionInput } from "./dto/register.suggestion.usecase.dto.js";
export type { RegisterSuggestionUseCaseOut as RegisterSuggestionResult } from "./dto/register.suggestion.usecase.dto.js";

/**
 * Idempotent registration of an agent-suggested rule. If a non-deleted
 * rule with the same signature already exists, returns it without
 * inserting a duplicate.
 */
export class RegisterSuggestionUseCase {
    constructor(
        private readonly ruleRepo: IRuleRepository,
        private readonly createRule: CreateRuleUseCase,
    ) {}

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
        });
        return { rule: created.rule, created: true };
    }
}

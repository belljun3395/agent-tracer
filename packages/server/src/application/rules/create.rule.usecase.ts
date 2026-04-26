import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { Rule, RuleExpectInput, RuleScope, RuleSeverity, RuleTriggerSource } from "~domain/verification/index.js";
import { buildRuleExpect, isRuleExpectMeaningful } from "~domain/verification/index.js";

export class InvalidRuleInputError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidRuleInputError";
    }
}

export interface CreateRuleInput {
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: RuleExpectInput;
    readonly scope: RuleScope;
    readonly taskId?: string;
    readonly severity?: RuleSeverity;
}

export interface CreateRuleDeps {
    readonly ruleRepo: IRuleRepository;
    readonly newId: () => string;
    readonly now: () => string;
}

export class CreateRuleUseCase {
    constructor(private readonly deps: CreateRuleDeps) {}

    async execute(input: CreateRuleInput): Promise<Rule> {
        if (!input.name.trim()) {
            throw new InvalidRuleInputError("Rule name must not be empty");
        }
        if (!isRuleExpectMeaningful(input.expect)) {
            throw new InvalidRuleInputError(
                "Rule expect must include at least one of tool, pattern, or commandMatches",
            );
        }
        if (input.scope === "task" && !input.taskId) {
            throw new InvalidRuleInputError("Task-scoped rules require a taskId");
        }
        if (input.scope === "global" && input.taskId) {
            throw new InvalidRuleInputError("Global rules must not include a taskId");
        }
        if (input.trigger != null && input.trigger.phrases.length === 0) {
            throw new InvalidRuleInputError("Trigger phrases must not be empty when trigger is provided");
        }

        return this.deps.ruleRepo.insert({
            id: this.deps.newId(),
            name: input.name.trim(),
            ...(input.trigger
                ? { trigger: { phrases: [...input.trigger.phrases] } }
                : {}),
            ...(input.triggerOn !== undefined ? { triggerOn: input.triggerOn } : {}),
            expect: buildRuleExpect(input.expect),
            scope: input.scope,
            ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
            source: "human",
            severity: input.severity ?? "warn",
            createdAt: this.deps.now(),
        });
    }
}

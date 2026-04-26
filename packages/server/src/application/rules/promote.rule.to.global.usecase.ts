import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { Rule, RuleExpectInput, RuleSeverity } from "~domain/verification/index.js";
import { buildRuleExpect, isRuleExpectMeaningful } from "~domain/verification/index.js";
import { InvalidRuleInputError } from "./create.rule.usecase.js";
import { RuleNotFoundError } from "./update.rule.usecase.js";

export interface PromoteRuleEdits {
    readonly name: string;
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly expect: RuleExpectInput;
    readonly severity: RuleSeverity;
    readonly rationale?: string;
}

export interface PromoteRuleInput {
    readonly id: string;
    readonly edits: PromoteRuleEdits;
}

export interface PromoteRuleDeps {
    readonly ruleRepo: IRuleRepository;
    readonly newId: () => string;
    readonly now: () => string;
}

export class PromoteRuleToGlobalUseCase {
    constructor(private readonly deps: PromoteRuleDeps) {}

    async execute(input: PromoteRuleInput): Promise<Rule> {
        const original = await this.deps.ruleRepo.findById(input.id);
        if (!original) throw new RuleNotFoundError(input.id);
        if (original.scope !== "task") {
            throw new InvalidRuleInputError("Only task-scoped rules can be promoted");
        }
        if (!input.edits.name.trim()) {
            throw new InvalidRuleInputError("Rule name must not be empty");
        }
        if (!isRuleExpectMeaningful(input.edits.expect)) {
            throw new InvalidRuleInputError(
                "Rule expect must include at least one of tool, pattern, or commandMatches",
            );
        }
        if (input.edits.trigger != null && input.edits.trigger.phrases.length === 0) {
            throw new InvalidRuleInputError("Trigger phrases must not be empty when trigger is provided");
        }

        return this.deps.ruleRepo.insert({
            id: this.deps.newId(),
            name: input.edits.name.trim(),
            ...(input.edits.trigger
                ? { trigger: { phrases: [...input.edits.trigger.phrases] } }
                : {}),
            expect: buildRuleExpect(input.edits.expect),
            scope: "global",
            source: "human",
            severity: input.edits.severity,
            ...(input.edits.rationale !== undefined ? { rationale: input.edits.rationale } : {}),
            createdAt: this.deps.now(),
        });
    }
}

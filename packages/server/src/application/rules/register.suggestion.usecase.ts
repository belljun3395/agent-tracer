import type { IRuleRepository } from "~application/ports/repository/rule.repository.js";
import type { Rule, RuleExpectInput, RuleSeverity, RuleTriggerSource } from "~domain/verification/index.js";
import { buildRuleExpect, computeRuleSignature } from "~domain/verification/index.js";

export interface RegisterSuggestionInput {
    readonly trigger?: { readonly phrases: readonly string[] };
    readonly triggerOn?: RuleTriggerSource;
    readonly expect: RuleExpectInput;
    readonly rationale: string;
    readonly severity?: RuleSeverity;
    readonly name?: string;
    readonly taskId: string;
}

export interface RegisterSuggestionResult {
    readonly ruleId: string;
    readonly reviewUrl: string;
}

export interface RegisterSuggestionDeps {
    readonly ruleRepo: IRuleRepository;
    readonly newId: () => string;
    readonly now: () => string;
    readonly dashboardBaseUrl: string;
    readonly backfill?: (rule: Rule) => Promise<void>;
}

export { computeRuleSignature as computeSuggestionSignature };

function stripTrailingSlash(url: string): string {
    return url.replace(/\/+$/g, "");
}

export class RegisterSuggestionUseCase {
    constructor(private readonly deps: RegisterSuggestionDeps) {}

    async execute(input: RegisterSuggestionInput): Promise<RegisterSuggestionResult> {
        const { ruleRepo } = this.deps;

        const signature = computeRuleSignature({
            ...(input.trigger ? { trigger: input.trigger } : {}),
            expect: input.expect,
        });

        const existing = await ruleRepo.findBySignature(signature);
        if (existing) {
            return this.toResult(existing.id);
        }

        const ruleId = this.deps.newId();
        const fallbackName = input.trigger?.phrases[0] ?? `rule-${ruleId.slice(0, 8)}`;
        const name = input.name ?? fallbackName;

        const rule = await ruleRepo.insert({
            id: ruleId,
            name,
            ...(input.trigger
                ? { trigger: { phrases: [...input.trigger.phrases] } }
                : {}),
            ...(input.triggerOn !== undefined ? { triggerOn: input.triggerOn } : {}),
            expect: buildRuleExpect(input.expect),
            scope: "task",
            taskId: input.taskId,
            source: "agent",
            severity: input.severity ?? "warn",
            rationale: input.rationale,
            createdAt: this.deps.now(),
        });

        await this.deps.backfill?.(rule);

        return this.toResult(ruleId);
    }

    private toResult(ruleId: string): RegisterSuggestionResult {
        const base = stripTrailingSlash(this.deps.dashboardBaseUrl);
        return {
            ruleId,
            reviewUrl: `${base}/rules#${ruleId}`,
        };
    }
}

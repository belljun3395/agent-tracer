import { RULE_SCOPE } from "./const/rule.const.js";
import type { RuleScope } from "./type/rule.value.type.js";
import type { RuleExpectation } from "./type/rule.expectation.type.js";
import { isRuleExpectMeaningful } from "./rule.predicates.policy.js";

export interface RuleInvariantTarget {
    readonly scope: RuleScope;
    readonly taskId?: string | null | undefined;
    readonly expect: RuleExpectation;
}

export interface RuleInvariantViolation {
    readonly message: string;
    readonly path: "taskId" | "expect";
}

export function checkRuleInvariants(target: RuleInvariantTarget): readonly RuleInvariantViolation[] {
    const violations: RuleInvariantViolation[] = [];
    if (target.scope === RULE_SCOPE.task && !target.taskId) {
        violations.push({ message: "Task-scoped rules require taskId", path: "taskId" });
    }
    if (target.scope === RULE_SCOPE.global && target.taskId) {
        violations.push({ message: "Global rules must not have taskId", path: "taskId" });
    }
    if (!isRuleExpectMeaningful(target.expect)) {
        violations.push({
            message: "expect must include at least one of action, pattern, or commandMatches",
            path: "expect",
        });
    }
    return violations;
}

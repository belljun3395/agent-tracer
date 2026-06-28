import type { RuleScope } from "./type/rule.value.type.js";
import type { RuleExpectInput } from "./type/rule.expectation.input.js";
import { isRuleExpectMeaningful } from "./rule.expect.policy.js";

export interface RuleInvariantTarget {
    readonly scope: RuleScope;
    readonly taskId?: string | null | undefined;
    readonly expect: RuleExpectInput;
}

export interface RuleInvariantViolation {
    readonly message: string;
    readonly path: "taskId" | "expect";
}

// 룰 생성의 도메인 불변식.
export function checkRuleInvariants(target: RuleInvariantTarget): readonly RuleInvariantViolation[] {
    const violations: RuleInvariantViolation[] = [];
    if (target.scope === "task" && !target.taskId) {
        violations.push({ message: "Task-scoped rules require taskId", path: "taskId" });
    }
    if (target.scope === "global" && target.taskId) {
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

import { RULE_SCOPE } from "./const/rule.const.js";
import type { Rule } from "./type/rule.type.js";
import type { RuleExpectation, RuleTrigger } from "./type/rule.expectation.type.js";
import type { RuleTriggerSource } from "./type/rule.value.type.js";

export function isTaskScopedRule(rule: Rule): rule is Rule & { taskId: string } {
    return rule.scope === RULE_SCOPE.task && typeof rule.taskId === "string" && rule.taskId.length > 0;
}

export function isRuleExpectMeaningful(expect: RuleExpectation): boolean {
    return (
        expect.action !== undefined ||
        typeof expect.pattern === "string" ||
        (Array.isArray(expect.commandMatches) && expect.commandMatches.length > 0)
    );
}

export function computeRuleSignature(rule: {
    readonly trigger?: RuleTrigger | undefined;
    readonly triggerOn?: RuleTriggerSource | null | undefined;
    readonly expect: RuleExpectation;
}): string {
    return JSON.stringify({
        phrases: rule.trigger ? [...rule.trigger.phrases].sort() : null,
        triggerOn: rule.triggerOn ?? null,
        tool: rule.expect.action ?? null,
        commandMatches: rule.expect.commandMatches
            ? [...rule.expect.commandMatches].sort()
            : null,
        pattern: rule.expect.pattern ?? null,
    });
}

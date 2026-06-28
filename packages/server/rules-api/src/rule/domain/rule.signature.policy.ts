import type { RuleTrigger } from "./type/rule.expectation.type.js";
import type { RuleExpectInput } from "./type/rule.expectation.input.js";

export function computeRuleSignature(rule: {
    readonly trigger?: RuleTrigger | undefined;
    readonly expect: RuleExpectInput;
}): string {
    return JSON.stringify({
        phrases: rule.trigger ? [...rule.trigger.phrases].sort() : null,

        tool: rule.expect.action ?? null,
        commandMatches: rule.expect.commandMatches
            ? [...rule.expect.commandMatches].sort()
            : null,
        pattern: rule.expect.pattern ?? null,
    });
}

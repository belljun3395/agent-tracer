import type { RuleExpectInput } from "./type/rule.expectation.input.js";

export function isRuleExpectMeaningful(expect: RuleExpectInput): boolean {
    return (
        expect.action !== undefined ||
        typeof expect.pattern === "string" ||
        (Array.isArray(expect.commandMatches) && expect.commandMatches.length > 0)
    );
}
